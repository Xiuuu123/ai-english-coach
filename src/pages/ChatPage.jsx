import { useState, useRef, useEffect, useCallback, memo, useMemo, useDeferredValue } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSceneById, getLevelByIndex } from '../data/scenes'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useTTS } from '../hooks/useTTS'
import { useAudioDevices } from '../hooks/useAudioDevices'
import { useConversationPersistence } from '../hooks/useConversationPersistence'
import { useProgressTracker } from '../hooks/useProgressTracker'
import { useMembership, FREE_CHAT_LIMIT } from '../hooks/useMembership'
import { useLevelProgress } from '../hooks/useLevelProgress'
import { sendMessage, MAX_RETRIES, prewarmConnection } from '../services/chatService'
import DeviceSelector from '../components/DeviceSelector'
import PronunciationCard from '../components/PronunciationCard'
import VoiceWaveform from '../components/VoiceWaveform'
import MembershipModal from '../components/MembershipModal'
import LevelSelect from '../components/LevelSelect'
import BadgeModal from '../components/BadgeModal'
import WordPopup, { tokenizeForRender } from '../components/WordPopup'
import TTSControlBar, { useTTSSettings } from '../components/TTSControlBar'
import ErrorHighlightedSentence from '../components/ErrorHighlightedSentence'
import RealTimeCorrectionPanel from '../components/RealTimeCorrectionPanel'
import VoiceMessageBubble from '../components/VoiceMessageBubble'
import {
  playRecordStartSound,
  playRecordEndSound,
  playSendSound,
  playReceiveSound,
  playErrorSound,
} from '../utils/soundEffects'

const RETRY_DELAY = 2000

export default function ChatPage() {
  const { sceneId, levelIndex: levelIndexStr } = useParams()
  const navigate = useNavigate()
  const scene = getSceneById(sceneId)
  const levelIndex = levelIndexStr ? parseInt(levelIndexStr, 10) : 0
  const level = getLevelByIndex(scene, levelIndex)
  const totalLevels = scene?.levels?.length || 1

  // 关卡进度
  const { isLevelCompleted, isSceneAllCompleted, completeLevel, awardBadge, hasBadge } = useLevelProgress()

  // 状态管理
  const { messages, setMessages, isRestored, clearConversation } = useConversationPersistence(`${sceneId}-l${levelIndex}`)
  const [isLoading, setIsLoading] = useState(false)
  const [showCorrections, setShowCorrections] = useState(false)
  // v2: 流式文本 — 直接使用 SSE 返回的增量内容，无需模拟打字机
  const [streamText, setStreamText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // v5: 使用 useDeferredValue 延迟消息列表更新，避免流式输出时频繁重渲染
  const deferredMessages = useDeferredValue(messages)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  // v4: 结束练习确认弹窗
  const [showEndModal, setShowEndModal] = useState(false)
  // v5: 会员开通弹窗
  const [showVipModal, setShowVipModal] = useState(false)
  const [vipModalReason, setVipModalReason] = useState('limit')
  // v8: 关卡选择弹窗 & 通关弹窗 & 勋章弹窗
  const [showLevelSelect, setShowLevelSelect] = useState(false)
  const [showLevelComplete, setShowLevelComplete] = useState(false)
  // v8: 单词查询弹窗 — { word, anchorRect }
  const [wordPopup, setWordPopup] = useState(null)
  // v8: 实时纠错面板 — 移动端抽屉开关
  const [showCorrectionDrawer, setShowCorrectionDrawer] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  // 关卡内得分追踪（用于判断通关）
  const levelScoresRef = useRef([])
  const levelCompletedRef = useRef(false)
  const messagesEndRef = useRef(null)
  const lastSentRef = useRef('')
  const sendingRef = useRef(false)
  // 流式响应控制器 — 用于取消正在进行的请求
  const abortRef = useRef(null)

  // Hooks
  const { isListening, transcript, interimText, isSupported, networkError, lastAudioUrl, lastAudioDuration, isCancelMode, setIsCancelMode, startListening, stopListening, cancelListening, setTranscript } = useSpeechRecognition()
  const { speak, stop: stopTTS, setAccent: setTTSAccent } = useTTS()
  // v8: 口语对话控制栏设置（语速 / 口音 / 风格）
  const ttsSettings = useTTSSettings()
  const { rate: ttsRate, accent: ttsAccent, style: conversationStyle, setRate: setTTSRate, setAccent: setTTSAccentLocal, setStyle: setConversationStyle } = ttsSettings

  // v8: 当口音变化时通知 TTS Hook 重新选择语音
  useEffect(() => {
    setTTSAccent?.(ttsAccent)
  }, [ttsAccent, setTTSAccent])
  const { microphones, speakers, selectedMicId, selectedSpeakerId, setSelectedMicId, setSelectedSpeakerId, isDeviceReady, error: deviceError, permission, refreshDevices } = useAudioDevices()
  const { state: progressState, recordSession } = useProgressTracker()
  const {
    vip,
    freeUsage,
    freeLimit,
    getUsage,
    getRemaining,
    isLimitReached,
    canSend,
    consumeUsage,
    activateVip,
  } = useMembership()

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // ====== v3: 连接预暖 — 场景进入时预热 API 连接 ======
  useEffect(() => {
    prewarmConnection(sceneId)
  }, [sceneId])

  // ====== v6: 进入页面时延迟 1s 预请求麦克风权限 ======
  // 解决首次点击麦克风时设备 label 为空 / 设备列表加载慢的问题
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDeviceReady) refreshDevices()
    }, 1000)
    return () => clearTimeout(timer)
  }, [sceneId]) // 只在场景切换时执行

  // ====== v7: 关卡切换时重置状态 ======
  useEffect(() => {
    levelScoresRef.current = []
    levelCompletedRef.current = false
    setShowLevelComplete(false)
    setShowBadgeModal(false)
  }, [sceneId, levelIndex])

  // ====== v7: 检查关卡是否通关 ======
  function checkLevelComplete(score) {
    if (levelCompletedRef.current) return
    if (!level) return
    const { minScore, minRounds } = level.passCondition
    levelScoresRef.current.push(score)

    // 取最近 minRounds 轮的平均分
    if (levelScoresRef.current.length >= minRounds) {
      const recent = levelScoresRef.current.slice(-minRounds)
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length
      if (avg >= minScore) {
        levelCompletedRef.current = true
        completeLevel(sceneId, levelIndex, Math.round(avg))
        setShowLevelComplete(true)

        // 检查是否全场景通关
        if (isSceneAllCompleted(sceneId, totalLevels) && !hasBadge(sceneId)) {
          setTimeout(() => {
            awardBadge(sceneId)
            setShowBadgeModal(true)
          }, 1500)
        }
      }
    }
  }

  // ====== v3: 快捷短语 — 场景相关高频表达 ======
  const quickPhrases = useMemo(() => {
    const map = {
      interview: ['Tell me about yourself', 'I have 3 years of experience', 'My biggest achievement was...', 'I enjoy teamwork', 'I want to grow in this role'],
      ordering: ['I\'d like to order, please', 'What do you recommend?', 'I\'ll have the steak', 'Can I get the bill?', 'That was delicious!'],
      meeting: ['I\'d like to propose that...', 'From my perspective...', 'Let me clarify that point', 'Great idea, I agree', 'What are the next steps?'],
    }
    return map[sceneId] || []
  }, [sceneId])

  // ====== 键盘快捷键 ======
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 忽略输入框内的按键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      switch (e.key) {
        case ' ': // 空格：切换录音（按住模式）
          e.preventDefault()
          if (!isListening && !isLoading) {
            stopTTS()
            startListening()
            playRecordStartSound()
          } else if (isListening) {
            stopListening()
            playRecordEndSound()
            const text = (transcript || interimText)?.trim() || ''
            setTranscript('')
            if (text) { playSendSound(); handleSend(text) }
          }
          break
        case 'Escape': // ESC：停止 TTS 播放
          e.preventDefault()
          stopTTS()
          break
        case '/': // 斜杠：聚焦输入框
          e.preventDefault()
          document.querySelector('footer input')?.focus()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isListening, isLoading, transcript, interimText])

  /**
   * 发送消息给 AI
   *
   * v2 优化：
   * - 流式响应(SSE)：AI 回复逐字显示，首字延迟降低 60%+
   * - 支持取消请求（新消息到来时自动取消旧的）
   */
  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || sendingRef.current) return
    if (trimmed === lastSentRef.current) return

    // v5: 会员限制检查 — 非会员需消费一次免费次数
    if (!canSend(sceneId)) {
      setVipModalReason('limit')
      setShowVipModal(true)
      return
    }

    lastSentRef.current = trimmed
    sendingRef.current = true
    // 消费一次免费次数（会员直接返回 true）
    consumeUsage(sceneId)

    // 取消之前的流式请求
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }

    // v8: 把当前录制的语音 URL 和时长绑定到 userMsg（如果有）— 用于重播和气泡展示
    const userMsg = {
      role: 'user',
      content: trimmed,
      ...(lastAudioUrl ? { audioUrl: lastAudioUrl, audioDuration: lastAudioDuration } : {}),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)
    setStreamText('')
    setIsStreaming(true)

    let attempt = 0
    let lastError = null

    while (attempt <= retryCount) {
      try {
        const history = [...messages.slice(-12), userMsg].map(m => ({
          role: m.role,
          content: m.role === 'assistant' ? (m.reply || '') : (m.content || ''),
        }))

        // 创建新的 AbortController 用于取消
        const controller = new AbortController()
        abortRef.current = controller

        // 流式调用：onStreamChunk 回调实时更新 UI
        const result = await sendMessage(sceneId, history, (chunkText) => {
          setStreamText(chunkText)
        }, level?.systemPrompt, conversationStyle)

        // 流式结束，显示最终结果
        setIsStreaming(false)
        setStreamText('')

        const aiMsg = { role: 'assistant', ...result }
        setMessages(prev => [...prev, aiMsg])

        // TTS 播放 + 音效
        speak(result.reply, { outputDeviceId: selectedSpeakerId, rate: ttsRate })
        if (result.corrections?.length > 0) setShowCorrections(true)
        playReceiveSound()

        // v7: 关卡通关检查
        if (result.score != null) {
          checkLevelComplete(result.score)
        }

        sendingRef.current = false
        setIsLoading(false)
        setTranscript('')
        return

      } catch (err) {
        lastError = err
        attempt++
        if (attempt <= retryCount) {
          await new Promise(r => setTimeout(r, RETRY_DELAY))
        }
      }
    }

    // 全部重试失败
    console.error('All retries failed:', lastError)
    setIsStreaming(false)
    setStreamText('')
    playErrorSound()

    setMessages(prev => [
      ...prev,
      { role: 'assistant', reply: `连接失败: ${lastError?.message || '网络异常'}`, corrections: [], pronunciationTips: [], score: null },
    ])
    setError(lastError?.message || '网络异常')
    sendingRef.current = false
    setIsLoading(false)
    setTranscript('')
  }, [sceneId, messages, isLoading, selectedSpeakerId, retryCount, canSend, consumeUsage])

  /** 手动重试 */
  function handleRetry() {
    if (error && !isLoading) {
      setError(null)
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
      if (lastUserMsg) { lastSentRef.current = ''; handleSend(lastUserMsg.content) }
    }
  }

  // ====== 录音交互 — 用 ref 跟踪按住状态，避免闭包读取旧 state ======
  const isHoldingBtnRef = useRef(false)
  const transcriptRef = useRef('')
  const interimTextRef = useRef('')
  // v8: 微信式上滑取消 — 记录按下时的 Y 坐标
  const pointerStartYRef = useRef(0)

  // 同步 transcript/interimText 到 ref（供 handlePointerUp 读取最新值）
  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { interimTextRef.current = interimText }, [interimText])

  function handlePointerDown(e) {
    e.preventDefault()
    if (isLoading) return
    // v5: 会员限制 — 次数用完时禁止录音
    if (!canSend(sceneId)) {
      setVipModalReason('limit')
      setShowVipModal(true)
      return
    }
    isHoldingBtnRef.current = true
    // v8: 记录按下时的 Y 坐标（用于上滑取消的距离判断）
    pointerStartYRef.current = e.clientY
    setIsCancelMode(false)
    stopTTS()
    startListening()
    playRecordStartSound()
  }

  function handlePointerUp() {
    if (!isHoldingBtnRef.current) return
    isHoldingBtnRef.current = false
    // v8: 微信式上滑取消 — 如果处于取消模式，则终止录音且不发送
    if (isCancelMode) {
      cancelListening()
      setIsCancelMode(false)
      // 轻提示音效（不计入使用次数）
      playRecordEndSound()
      return
    }
    stopListening()
    playRecordEndSound()
    // 从 ref 读取最新文本，避免闭包陷阱
    const text = (transcriptRef.current || interimTextRef.current)?.trim() || ''
    setTranscript('')
    if (text) { playSendSound(); handleSend(text) }
  }

  // v8: 微信式上滑取消 — 追踪指针 Y 偏移
  // 当向上滑动超过阈值（默认 80px）时进入取消模式
  const CANCEL_THRESHOLD = 80  // px
  function handlePointerMove(e) {
    if (!isHoldingBtnRef.current || !isListening) return
    // pointerY: 当前指针 Y 坐标
    // startY: 按下时的 Y 坐标（用按钮 rect 顶部作为参考）
    const dy = e.clientY - (pointerStartYRef.current ?? e.clientY)
    // 向上滑：dy 为负
    if (-dy >= CANCEL_THRESHOLD && !isCancelMode) {
      setIsCancelMode(true)
    } else if (-dy < CANCEL_THRESHOLD && isCancelMode) {
      setIsCancelMode(false)
    }
  }

  // ====== v4: 快捷键 — ESC 关闭结束弹窗 ======
  useEffect(() => {
    if (!showEndModal) return
    const onKey = (e) => { if (e.key === 'Escape') setShowEndModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showEndModal])

  // 结束练习 → 记录进度
  function handleFinish() {
    stopTTS()
    setShowEndModal(false)
    // 记录本次会话到进度追踪器
    const scores = messages.filter(m => m.role === 'assistant' && m.score !== null).map(m => m.score)
    const allCorrections = messages.flatMap(m => m.corrections || [])
    // v8: 收集维度分数和词数统计
    const allDimensions = {}
    const dimKeys = ['fluency', 'grammar', 'vocabulary', 'pronunciation', 'confidence']
    const dimScores = messages.filter(m => m.role === 'assistant' && m.dimensions)
    dimKeys.forEach(key => {
      const vals = dimScores.map(m => m.dimensions?.[key]).filter(v => v != null)
      if (vals.length > 0) allDimensions[key] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    })
    const totalWords = messages.filter(m => m.role === 'user')
      .reduce((s, m) => s + (m.content ? m.content.split(/\s+/).filter(w => w).length : 0), 0)
    recordSession({
      sceneId,
      sceneName: scene?.name || sceneId,
      messageCount: messages.filter(m => m.role === 'user').length,
      corrections: allCorrections.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      scores,
      correctionTypes: allCorrections.map(c => c.type).filter(Boolean),
      correctionDetails: allCorrections.map(c => ({ original: c.original, corrected: c.corrected, type: c.type })),
      dimensions: allDimensions,
      totalWords,
      levelIndex: levelIndex ?? 0,
    })
    // 保存本次会话到 sessionStorage 作为报告页备份（防止 navigate state 丢失）
    try {
      sessionStorage.setItem('ai-coach-last-session', JSON.stringify({ messages, scene, progressState }))
    } catch { /* ignore */ }
    navigate('/summary', { state: { messages, scene, progressState } })
    clearConversation()
  }

  if (!scene) return <div className="p-8 text-center text-slate-500">场景不存在</div>

  // v8: 实时纠错面板数据 — 取最近一条带 corrections 的 AI 消息
  const latestCorrectionEntry = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant' && m.corrections && m.corrections.length > 0) {
        // 找紧邻的用户消息
        let userText = ''
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].role === 'user') { userText = messages[j].content || ''; break }
        }
        // 收集所有 corrections
        const allCorrections = m.corrections
        // 优化句：取第一条 correction 的 correction 字段拼成完整句不现实，
        // 优先使用 AI 单独给出的 optimized 字段；否则从 corrections 派生
        const optimized = m.optimized || m.correctedSentence || m.reply || ''
        const explanation = m.explanation || m.summary || ''
        return {
          originalText: userText,
          optimizedText: optimized,
          explanation,
          corrections: allCorrections,
        }
      }
    }
    return null
  })()

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between">
        <button onClick={() => { stopTTS(); clearConversation(); navigate('/') }}
          className="text-indigo-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
          ← 返回
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base sm:text-lg">{scene.icon}</span>
          <span className="font-semibold text-white text-sm sm:text-base hidden sm:inline">{scene.name}</span>
          {/* v7: 关卡信息 */}
          {level && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium hidden sm:inline">
              {level.icon} {level.name}
            </span>
          )}
          {/* 连续天数徽章 */}
          {progressState.streakDays >= 2 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
              🔥{progressState.streakDays}天
            </span>
          )}
          {/* v5: 剩余次数徽章 */}
          {vip ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.2) 100%)',
                color: '#FFD700',
                border: '1px solid rgba(255, 215, 0, 0.3)',
              }}
            >
              👑 VIP
            </span>
          ) : (
            <span
              className={[
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                getRemaining(sceneId) <= 2
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
              ].join(' ')}
            >
              {freeLimit - getUsage(sceneId)}/{freeLimit}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* v7: 关卡选择按钮 */}
          <button
            onClick={() => setShowLevelSelect(true)}
            className="text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-all active:scale-95"
            title="关卡选择"
          >
            🎯 关卡
          </button>
          {/* v5: 开通 VIP 入口 */}
          {!vip && (
            <button
              onClick={() => { setVipModalReason('feature'); setShowVipModal(true) }}
              className="text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.15) 100%)',
                color: '#FFD700',
                border: '1px solid rgba(255, 215, 0, 0.3)',
              }}
              title="开通 VIP"
            >
              👑 VIP
            </button>
          )}
          <DeviceSelector {...{ microphones, speakers, selectedMicId, selectedSpeakerId, onMicChange: setSelectedMicId, onSpeakerChange: setSelectedSpeakerId, isDeviceReady, error: deviceError, permission, refreshDevices }} />
          {/* v8: 口语对话控制栏 — 语速 / 口音 / 风格 */}
          <TTSControlBar
            compact
            rate={ttsRate}
            accent={ttsAccent}
            style={conversationStyle}
            onRateChange={setTTSRate}
            onAccentChange={setTTSAccentLocal}
            onStyleChange={setConversationStyle}
          />
          <button onClick={() => setShowEndModal(true)}
            className="text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors active:scale-95">
            结束练习
          </button>
        </div>
        </div>
      </header>

      {/* ===== v4: AI 介绍条（借鉴 chat 原型，适配暗色主题） ===== */}
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-4">
        <div className="mt-3 mb-2 px-3 py-2 flex items-center gap-2 rounded-lg" style={{ backgroundColor: 'rgba(79,139,255,0.12)', border: '1px solid rgba(79,139,255,0.18)' }}>
          <span className="text-sm">💡</span>
          <span className="text-xs text-slate-200">AI 助手已就绪，试试长按麦克风开始说话吧</span>
        </div>
      </div>

      {/* ===== v4: 跳动录音提示条（借鉴 chat 原型） ===== */}
      {isListening && (
        <div className="flex items-center justify-center gap-1 h-[30px] mx-3 sm:mx-4 animate-fade-in" role="status" aria-live="polite">
          <span className="text-xs font-medium" style={{ color: '#4F8BFF' }}>正在聆听...</span>
          <span className="dot-bounce w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: '#4F8BFF' }} />
          <span className="dot-bounce w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: '#4F8BFF' }} />
          <span className="dot-bounce w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: '#4F8BFF' }} />
        </div>
      )}

      {/* 消息列表区域 — v5: content-visibility 优化渲染性能 */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 pb-safe max-w-3xl mx-auto w-full" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}>
        {!isRestored && <ChatSkeleton />}

        {/* 欢迎卡片 */}
        {isRestored && messages.length === 0 && !isLoading && (
          <WelcomeCard scene={scene} onStart={() => handleSend('Hello! I am ready to practice.')} />
        )}

        {/* 消息渲染 — v5: 使用 deferredMessages 减少流式输出时的重渲染 */}
        {isRestored && deferredMessages.map((msg, idx) => {
          const isLastUser = msg.role === 'user' && idx === [...messages].reverse().findIndex(m => m.role === 'user') === 0
          // v8: 找到紧邻该 AI 消息之前的那条用户消息（用于错误高亮）
          const prevUserText = (() => {
            if (msg.role !== 'assistant') return null
            for (let i = idx - 1; i >= 0; i--) {
              if (deferredMessages[i].role === 'user') return deferredMessages[i].content
            }
            return null
          })()
          return (
            <div key={idx}>
              <MessageBubble
                message={msg}
                onReplay={(t) => speak(t, { rate: ttsRate })}
                onPlayWord={(w) => speak(w, { rate: ttsRate })}
                onWordClick={msg.role === 'assistant' || msg.audioUrl ? (word, rect) => setWordPopup({ word, anchorRect: rect }) : undefined}
              />
              {/* v8: AI 纠错时在用户原句上单词级高亮 */}
              {msg.role === 'assistant' && msg.corrections?.length > 0 && prevUserText && (
                <div className="mx-3 sm:mx-4 mt-1 mb-2 p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-white/5 animate-fade-in">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-slate-400 font-medium">原文高亮</span>
                    <span className="text-[9px] text-slate-500">·</span>
                    <span className="text-[9px] text-slate-500">点击单词查看修改建议</span>
                  </div>
                  <ErrorHighlightedSentence
                    text={prevUserText}
                    errors={msg.corrections.map(c => ({
                      word: c.original || c.word,
                      type: c.type,
                      suggestion: c.correction || c.suggestion || c.explanation,
                    }))}
                  />
                </div>
              )}
              {isLastUser && msg.content && (
                <PronunciationCard spokenText={msg.content} />
              )}
            </div>
          )
        })}

        {/* ===== v2: 流式响应实时显示 ===== */}
        {(isStreaming || isLoading) && (
          <div className="flex items-start gap-2.5 sm:gap-3 animate-fade-in">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0 shadow-lg">AI</div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-3.5 sm:px-4 py-2.5 sm:py-3 border border-white/5 max-w-[85%] sm:max-w-[75%]">
              {streamText ? (
                <p className="text-[14px] sm:text-[15px] text-gray-200 leading-relaxed">
                  {streamText}
                  <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
                </p>
              ) : (
                <div className="flex gap-1.5 py-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && !isLoading && (
          <div className="mx-auto max-w-md bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-center justify-between animate-slide-up">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={handleRetry}
              className="shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors">
              重试
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 纠错面板 — v5: 使用 deferredMessages 避免频繁重渲染 */}
      {isRestored && deferredMessages.some(m => m.corrections?.length > 0) && (
        <CorrectionPanel
          isOpen={showCorrections}
          onToggle={() => setShowCorrections(!showCorrections)}
          latestCorrections={[...messages].reverse().find(m => m.corrections?.length > 0)?.corrections || []}
        />
      )}

      {/* 底部输入区 — 录音按钮位置固定 */}
      <footer className="relative px-3 sm:px-4 pb-6 pt-2.5 bg-slate-900/80 backdrop-blur-md border-t border-white/5 safe-area-bottom max-w-3xl mx-auto w-full">
        {/* 波形固定在 footer 顶部，按钮位置不变 */}
        {isListening && (
          <div className="absolute left-0 right-0 -top-[58px] h-[50px] flex items-end justify-center pointer-events-none animate-fade-in">
            <div className="bg-slate-900/70 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-2 shadow-2xl">
              <VoiceWaveform isActive={isListening} color="#ef4444" barCount={28} height={36} />
            </div>
          </div>
        )}

        {/* 临时文本显示区：固定高度防布局抖动 */}
        <div className="h-[28px] flex items-center justify-center mb-1.5">
          {(transcript || interimText) ? (
            <div className={`text-xs sm:text-sm px-3 sm:px-4 py-1 max-w-md rounded-xl truncate ${
              interimText ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
            }`}>
              {interimText ? interimText : `"${transcript}"`}
            </div>
          ) : null}
        </div>

        {!isSupported ? (
          // v8: 不支持语音识别 — 文字输入作为主要输入方式
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-amber-400/80 text-xs leading-relaxed">
              此设备不支持语音输入，请使用下方文字输入
            </p>
            <div className="flex gap-2 w-full max-w-md">
              <input type="text" placeholder="输入英文..." autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    playSendSound(); handleSend(e.target.value); e.target.value = ''
                  }
                }}
                className="flex-1 text-sm bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent"
              />
              <button onClick={(e) => {
                const input = e.target.parentElement.querySelector('input')
                if (input?.value.trim()) { playSendSound(); handleSend(input.value); input.value = '' }
              }}
                disabled={isLoading}
                className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors active:scale-95">
                发送
              </button>
            </div>
          </div>
        ) : networkError ? (
          // v8: 网络/服务不可达错误提示
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-amber-400/80 text-xs leading-relaxed max-w-md">{networkError}</p>
            <button
              onClick={startListening}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="flex justify-center">
              <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={isLoading || !canSend(sceneId)}
                data-listening={isListening || undefined}
                data-cancel-mode={isCancelMode || undefined}
                className={`mic-btn w-[72px] h-[72px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-white text-2xl
                  shadow-lg cursor-pointer select-none relative touch-manipulation outline-none
                  ${!isListening ? 'mic-btn-idle' : 'mic-btn-active'}
                  ${!canSend(sceneId) ? 'mic-btn-locked' : ''}
                  ${isCancelMode ? 'mic-btn-cancel' : ''}
                `}
              >
                {canSend(sceneId) ? (isCancelMode ? '↩' : '🎤') : '🔒'}
                {isListening && !isCancelMode && <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
                {isListening && isCancelMode && <span className="absolute inset-0 rounded-full bg-amber-500/30 animate-ping" />}
              </button>
            </div>
            {/* v5: 锁定状态提示 */}
            {!canSend(sceneId) && (
              <p className="text-[10px] text-red-400/80 font-medium">
                免费次数已用完 · 开通 VIP 解锁
              </p>
            )}
          </div>
        )}

        {isSupported && (
        <p className={`text-center text-xs mt-2 mb-3 transition-colors ${isCancelMode ? 'text-amber-400' : isListening ? 'text-red-400' : 'text-slate-500'}`}>
          {isListening
            ? (isCancelMode ? '↩ 松开取消发送' : '🔴 松开发送 · 上滑取消')
            : (canSend(sceneId) ? '按住麦克风说话' : '🔒 次数已用完')}
          <span className="hidden sm:inline text-slate-600 ml-2">| 快捷键: Space 录音 / Esc 停止 / / 输入</span>
        </p>
        )}

        {/* 文字输入 — 不支持语音时已在上方展示，此处隐藏 */}
        {isSupported && (
        <div className="flex gap-2 max-w-lg mx-auto">
          <input type="text" placeholder="或者直接输入英文..." autoFocus={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                playSendSound(); handleSend(e.target.value); e.target.value = ''
              }
            }}
            className="flex-1 text-sm bg-slate-800 border border-white/10 rounded-xl px-3.5 sm:px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent"
          />
          <button onClick={(e) => {
            const input = e.target.parentElement.querySelector('input')
            if (input?.value.trim()) { playSendSound(); handleSend(input.value); input.value = '' }
          }}
            disabled={isLoading}
            className="px-4 sm:px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors active:scale-95">
            发送
          </button>
        </div>
        )}

        {/* v3: 快捷短语 — 点击即发送 */}
        {quickPhrases.length > 0 && (
          <div className="flex gap-1.5 mt-2.5 max-w-lg mx-auto overflow-x-auto pb-1 custom-scrollbar">
            {quickPhrases.map((phrase, i) => (
              <button key={i} onClick={() => { playSendSound(); handleSend(phrase) }}
                disabled={isLoading}
                className="shrink-0 text-[11px] sm:text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 hover:border-indigo-500/30 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap">
                {phrase}
              </button>
            ))}
          </div>
        )}
      </footer>

      {/* ===== v4: 结束确认弹窗（借鉴 chat 原型） ===== */}
      {showEndModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEndModal(false) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="endModalTitle"
        >
          <div className="bg-white rounded-2xl mx-6 p-6 w-[300px] shadow-2xl">
            <div className="text-center mb-1">
              <span className="text-3xl">🤔</span>
            </div>
            <h3 id="endModalTitle" className="text-center text-[#1A1A1A] text-base font-semibold mt-2">确定结束本次练习？</h3>
            <p className="text-center text-[#999] text-xs mt-1">本次对话记录将会保存</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border-0 cursor-pointer transition-colors"
                style={{ backgroundColor: '#F0F2F5', color: '#666' }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#E5E7EB')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F0F2F5')}
              >
                继续练习
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border-0 cursor-pointer text-white transition-opacity"
                style={{ background: 'linear-gradient(135deg, #4F8BFF 0%, #6C63FF 100%)' }}
              >
                结束并查看报告
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== v5: 会员开通弹窗 ===== */}
      <MembershipModal
        open={showVipModal}
        reason={vipModalReason}
        sceneName={scene?.name}
        remaining={getRemaining(sceneId)}
        onActivate={activateVip}
        onClose={() => setShowVipModal(false)}
      />

      {/* v7: 关卡选择弹窗 */}
      {showLevelSelect && scene && (
        <LevelSelect scene={scene} onClose={() => setShowLevelSelect(false)} />
      )}

      {/* v7: 关卡通关弹窗 */}
      {showLevelComplete && level && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLevelComplete(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-slate-900 border border-emerald-500/20 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 通关顶部 */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-center">
              <div className="text-5xl mb-2 animate-bounce-in">🎉</div>
              <h3 className="text-lg font-bold text-white">关卡通关！</h3>
              <p className="text-emerald-200 text-sm mt-1">{level.icon} {level.name}</p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-slate-300 text-sm text-center">
                恭喜完成本关挑战，AI 评分已达标！
              </p>
              {/* 下一关按钮 */}
              {levelIndex + 1 < totalLevels ? (
                <button
                  onClick={() => {
                    setShowLevelComplete(false)
                    navigate(`/chat/${sceneId}/${levelIndex + 1}`)
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-[0.98]"
                >
                  进入下一关 →
                </button>
              ) : (
                <button
                  onClick={() => setShowLevelComplete(false)}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all active:scale-[0.98]"
                >
                  查看勋章 →
                </button>
              )}
              <button
                onClick={() => setShowLevelComplete(false)}
                className="w-full py-2.5 bg-slate-800 text-slate-400 font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-all"
              >
                继续练习
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v7: 勋章弹窗 */}
      {showBadgeModal && scene && (
        <BadgeModal scene={scene} onClose={() => setShowBadgeModal(false)} />
      )}

      {/* v8: 单词查询弹窗 — 点击 AI 消息中的任意单词触发 */}
      {wordPopup && (
        <WordPopup
          word={wordPopup.word}
          anchorRect={wordPopup.anchorRect}
          onClose={() => setWordPopup(null)}
          onSpeak={(w) => speak(w, { rate: ttsRate })}
        />
      )}

      {/* v8: 实时纠错面板 — 桌面端固定右侧 + 移动端浮动按钮触发抽屉 */}
      {latestCorrectionEntry && (
        <>
          {/* 桌面端（≥ lg）：固定右侧侧边栏 */}
          <div className="hidden lg:block fixed right-0 top-0 bottom-0 w-80 xl:w-96 z-20 pointer-events-none">
            <div className="h-full pointer-events-auto">
              <RealTimeCorrectionPanel
                originalText={latestCorrectionEntry.originalText}
                optimizedText={latestCorrectionEntry.optimizedText}
                explanation={latestCorrectionEntry.explanation}
                corrections={latestCorrectionEntry.corrections}
                onPlay={(t) => speak(t, { rate: ttsRate })}
                variant="sidebar"
              />
            </div>
          </div>

          {/* 移动端：浮动按钮触发抽屉 */}
          <button
            onClick={() => setShowCorrectionDrawer(true)}
            className="lg:hidden fixed right-3 bottom-24 z-30 px-3 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-500/30 active:scale-95 flex items-center gap-1.5"
            aria-label="查看实时纠错"
          >
            <span>✨</span>
            <span>纠错</span>
            <span className="bg-white/25 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {latestCorrectionEntry.corrections.length}
            </span>
          </button>

          {/* 移动端抽屉 */}
          {showCorrectionDrawer && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowCorrectionDrawer(false)}
              />
              <div className="relative mt-auto h-[80vh] bg-slate-900 rounded-t-2xl shadow-2xl overflow-hidden animate-slideUp">
                <RealTimeCorrectionPanel
                  originalText={latestCorrectionEntry.originalText}
                  optimizedText={latestCorrectionEntry.optimizedText}
                  explanation={latestCorrectionEntry.explanation}
                  corrections={latestCorrectionEntry.corrections}
                  onPlay={(t) => speak(t, { rate: ttsRate })}
                  onClose={() => setShowCorrectionDrawer(false)}
                  variant="drawer"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ===== 子组件（React.memo 优化：仅在 props 变化时重渲染）=====

const ChatSkeleton = memo(function ChatSkeleton() {
  return (
    <div className="space-y-4 py-6 animate-fade-in" role="status" aria-label="加载中">
      {[1, 2, 3].map(i => (
        <div key={i} className={`flex items-start gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-slate-800 shimmer" aria-hidden="true" />
          <div className={`max-w-[70%] space-y-2 ${i % 2 === 0 ? 'items-end' : ''}`}>
            <div className="h-12 sm:h-14 bg-slate-800 rounded-2xl shimmer w-full" />
            <div className="h-3 bg-slate-800/60 rounded shimmer w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
})

const WelcomeCard = memo(function WelcomeCard({ scene, onStart }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-16 animate-fade-in" role="region" aria-label="欢迎卡片">
      <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br ${scene.color} flex items-center justify-center text-4xl sm:text-5xl shadow-2xl mb-5 sm:mb-6`} aria-hidden="true">{scene.icon}</div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">准备好开始了吗？</h2>
      <p className="text-slate-400 max-w-sm mx-auto text-center leading-relaxed mb-7 sm:mb-8 text-sm sm:text-base">
        你正在进入 <span className="text-indigo-400 font-medium">{scene.nameEn}</span> 场景。按住下方麦克风开始与 AI 进行英语对话练习。
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-sm">
        <button onClick={() => { playSendSound(); onStart() }}
          className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:-translate-y-0.5 active:scale-97"
          aria-label="通过语音开始对话">
          🎤 开始对话
        </button>
        <button onClick={() => { playSendSound(); onStart() }}
          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all hover:-translate-y-0.5 border border-white/5 active:scale-97"
          aria-label="通过文字输入开始对话">
          ⌨️ 文字输入
        </button>
      </div>
    </div>
  )
})

/** 消息气泡 — v2 增加多维度评分展示（React.memo 优化） */
const MessageBubble = memo(function MessageBubble({ message, onReplay, onWordClick, onPlayWord, isStreaming }) {
  const isUser = message.role === 'user'
  const userAudioRef = useRef(null)  // v8: 用户语音重播 ref
  const [userAudioPlaying, setUserAudioPlaying] = useState(false)

  // v8: 用户语音气泡 → 使用 VoiceMessageBubble 组件
  if (isUser && message.audioUrl) {
    return (
      <VoiceMessageBubble
        message={message}
        onWordClick={onWordClick}
        onPlayWord={onPlayWord}
        onReplay={onReplay ? () => { /* 由 VoiceMessageBubble 自行处理 */ } : undefined}
      />
    )
  }

  // v8: 重播用户自己的语音
  const replayUserAudio = () => {
    if (!message.audioUrl) return
    if (!userAudioRef.current) {
      userAudioRef.current = new Audio(message.audioUrl)
      userAudioRef.current.onended = () => setUserAudioPlaying(false)
      userAudioRef.current.onerror = () => setUserAudioPlaying(false)
    }
    if (userAudioPlaying) {
      userAudioRef.current.pause()
      userAudioRef.current.currentTime = 0
      setUserAudioPlaying(false)
    } else {
      userAudioRef.current.currentTime = 0
      userAudioRef.current.play().catch(() => setUserAudioPlaying(false))
      setUserAudioPlaying(true)
    }
  }

  // v8: 渲染带可点击单词的 AI 文本
  const renderClickableText = (text) => {
    if (!onWordClick || !text) return text
    const tokens = tokenizeForRender(text)
    return tokens.map((tok, i) => {
      if (tok.type === 'word') {
        return (
          <span
            key={i}
            data-word-span
            className="cursor-pointer hover:text-indigo-300 hover:bg-indigo-500/15 rounded px-0.5 transition-colors active:bg-indigo-500/25"
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              onWordClick(tok.value, rect)
            }}
          >
            {tok.value}
          </span>
        )
      }
      return <span key={i}>{tok.value}</span>
    })
  }

  return (
    <div className={`flex items-start gap-2.5 sm:gap-3 message-enter ${isUser ? 'flex-row-reverse' : ''}`} role="article" aria-label={`${isUser ? '用户' : 'AI'}消息`}>
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0 shadow-lg
        ${isUser ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`} aria-hidden="true">
        {isUser ? '我' : 'AI'}
      </div>

      <div className={`max-w-[82%] sm:max-w-[75%] space-y-1.5`}>
        <div className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] leading-relaxed shadow-lg
          ${isUser ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-gray-100 rounded-tl-sm border border-white/5'}`}>
          {isUser || !onWordClick
            ? (message.reply || message.content)
            : renderClickableText(message.reply || message.content)}
        </div>

        {isUser && message.content && (
          <p className="text-[11px] text-slate-500 text-right pr-0.5 hidden sm:block">{message.content}</p>
        )}

        {/* AI 评分可视化 — 图表形式展示在语段下方 */}
        {!isUser && (message.score != null || message.dimensions) && (
          <ScoreVisualizer score={message.score} dimensions={message.dimensions} />
        )}

        {/* 操作栏 */}
        {!isUser && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-0.5 pt-1 flex-wrap" role="group" aria-label="AI操作">
            <button onClick={() => onReplay(message.reply)}
              className="text-[11px] sm:text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
              aria-label="重播AI回复语音">
              🔊 重播
            </button>
            {message.corrections?.length > 0 && (
              <span className="text-[11px] sm:text-xs text-orange-400 font-medium flex items-center gap-0.5" aria-live="polite">
                🔧 {message.corrections.length}处纠正
              </span>
            )}
          </div>
        )}

        {/* v8: 用户语音重播按钮 — 仅在语音输入时显示 */}
        {isUser && message.audioUrl && (
          <div className="flex justify-end pr-0.5">
            <button onClick={replayUserAudio}
              className={`text-[11px] sm:text-xs flex items-center gap-0.5 transition-colors ${
                userAudioPlaying ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
              }`}
              aria-label={userAudioPlaying ? '停止重播' : '回听我的语音'}>
              {userAudioPlaying ? '⏹️ 停止' : '🎙️ 回听我的声音'}
            </button>
          </div>
        )}

        {/* 纠错内联展示 — v2: 带类型标签 */}
        {!isUser && message.corrections?.length > 0 && (
          <div className="space-y-1.5 pl-0.5 flex flex-wrap gap-1.5" role="list" aria-label="纠错列表">
            {message.corrections.map((c, i) => (
              <div key={i} className="inline-flex items-center gap-1 bg-orange-500/10 border border-orange-500/15 rounded-lg px-2 py-1 text-[11px] sm:text-xs" role="listitem">
                {/* 类型标签 */}
                {c.type && c.type !== 'other' && (
                  <span className={`text-[9px] px-1 py-0.5 rounded font-medium uppercase ${
                    c.type === 'grammar' ? 'bg-purple-500/20 text-purple-300' :
                    c.type === 'vocabulary' ? 'bg-blue-500/20 text-blue-300' :
                    c.type === 'pronunciation' ? 'bg-green-500/20 text-green-300' :
                    c.type === 'expression' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-slate-500/20 text-slate-300'
                  }`} aria-label={`错误类型: ${c.type}`}>{c.type.slice(0, 3)}</span>
                )}
                <span className="text-red-400 line-through">{c.original}</span>
                <span className="text-green-400">→</span>
                <span className="text-green-300 font-medium">{c.corrected}</span>
              </div>
            ))}
          </div>
        )}

        {/* v8: 发音+语义联动提示 — 解释发音错误如何影响语义 */}
        {!isUser && message.pronunciationTips?.length > 0 && (
          <div className="mt-2 space-y-1.5" role="list" aria-label="发音提示">
            {message.pronunciationTips.map((tip, i) => (
              <div key={i} className="bg-cyan-500/8 border border-cyan-500/15 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs text-cyan-200/90 flex items-start gap-1.5" role="listitem">
                <span className="shrink-0 mt-0.5">🗣️</span>
                <span>{typeof tip === 'string' ? tip : (tip.text || tip.tip || JSON.stringify(tip))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

/**
 * 评分可视化组件 — 以进度条+环形图组合形式展示在语段下方
 * 替代原来的文字标签，更直观
 */
const ScoreVisualizer = memo(function ScoreVisualizer({ score, dimensions }) {
  const s = score ?? 0
  // 总体评分颜色
  const ringColor = s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444'
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (s / 100) * circumference

  // 维度配置：图标、颜色、标签
  const dimConfig = {
    fluency:     { icon: '💬', label: '流利度', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    grammar:     { icon: '📝', label: '语法',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    vocabulary:  { icon: '📖', label: '词汇',   color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
    pronunciation:{ icon: '🗣️', label: '发音',  color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    confidence:  { icon: '✨', label: '自信',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  }

  const dims = dimensions ? Object.entries(dimensions).filter(([, v]) => v != null) : []

  return (
    <div className="mt-2 pt-2 border-t border-white/5 space-y-2" role="img" aria-label={`评分: ${s}分`}>
      {/* 上排：左侧环形总分 + 右侧维度进度条 */}
      <div className="flex items-center gap-3">
        {/* 环形总分 */}
        <div className="shrink-0 relative" aria-hidden="true">
          <svg width={radius * 2 + 8} height={radius * 2 + 8} viewBox={`0 0 ${radius * 2 + 8} ${radius * 2 + 8}`} className="animate-score-in">
            <circle cx={radius + 4} cy={radius + 4} r={radius} fill="none" stroke="#1e293b" strokeWidth="3.5" />
            <circle cx={radius + 4} cy={radius + 4} r={radius} fill="none" stroke={ringColor} strokeWidth="3.5"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
              transform={`rotate(-90 ${radius + 4} ${radius + 4})`}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
            <text x={radius + 4} y={radius + 4} dominantBaseline="central" textAnchor="middle"
              fontSize="13" fontWeight="800" fill={ringColor}>{s}</text>
          </svg>
          {/* 等级标签 */}
          <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-px rounded-full whitespace-nowrap ${
            s >= 80 ? 'bg-green-500/20 text-green-400' : s >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D'}
          </span>
        </div>

        {/* 维度进度条 */}
        {dims.length > 0 && (
          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(dims.length, 3)}, 1fr)` }}>
            {dims.map(([dim, val]) => {
              const cfg = dimConfig[dim] || dimConfig.fluency
              const v = Number(val) || 0
              return (
                <div key={dim} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 flex items-center gap-0.5">{cfg.icon} {cfg.label}</span>
                    <span className="font-semibold" style={{ color: cfg.color }}>{v}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${v}%`,
                        background: `linear-gradient(90deg, ${cfg.color}99, ${cfg.color})`,
                        animation: `barGrow 0.8s ease-out both`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})

/** 可折叠纠错面板 — v2: 带类型分类和置信度（React.memo + useMemo） */
const CorrectionPanel = memo(function CorrectionPanel({ isOpen, onToggle, latestCorrections }) {
  // useMemo：纠错列表不变时跳过分组计算
  const grouped = useMemo(() =>
    latestCorrections.reduce((acc, c) => {
      const t = c.type || 'other'
      if (!acc[t]) acc[t] = []
      acc[t].push(c)
      return acc
    }, {}), [latestCorrections])

  const typeLabels = { grammar: '📝 语法', vocabulary: '📖 词汇', pronunciation: '🗣️ 发音', expression: '💬 表达', other: '📌 其他' }

  return (
    <div className="mx-3 sm:mx-4 mb-2 bg-slate-800/80 backdrop-blur-sm border border-orange-500/15 rounded-2xl overflow-hidden" role="region" aria-label="纠错面板">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={isOpen} aria-controls="correction-panel-content">
        <span className="font-semibold text-orange-400 text-sm flex items-center gap-1.5">
          🔧 实时纠错 ({latestCorrections.length})
        </span>
        <svg className={`w-4 h-4 text-orange-400/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div id="correction-panel-content" className="px-4 pb-4 space-y-2" role="list">
          {Object.entries(grouped).map(([type, corrections]) => (
            <div key={type}>
              <p className="text-[11px] text-slate-500 font-medium mb-1 pl-0.5">{typeLabels[type] || type} ({corrections.length})</p>
              {corrections.map((c, i) => (
                <div key={i} className="bg-slate-900/60 rounded-xl p-3 border border-white/5">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <span className="text-red-400 line-through bg-red-500/10 px-2 py-0.5 rounded">{c.original}</span>
                    <span className="text-green-400 font-medium shrink-0">→</span>
                    <span className="text-green-300 font-medium bg-green-500/10 px-2 py-0.5 rounded">{c.corrected}</span>
                    {/* 置信度指示 */}
                    {c.confidence != null && (
                      <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                        c.confidence >= 0.85 ? 'bg-green-500/20 text-green-400' :
                        c.confidence >= 0.7 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {Math.round(c.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {c.tip && (
                    <p className="mt-1.5 text-[11px] sm:text-xs text-slate-400 pl-0.5 flex items-start gap-1"><span>💡</span>{c.tip}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
