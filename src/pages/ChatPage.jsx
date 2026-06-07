import { useState, useRef, useEffect, useCallback, memo, useMemo, useDeferredValue } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSceneById } from '../data/scenes'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useTTS } from '../hooks/useTTS'
import { useAudioDevices } from '../hooks/useAudioDevices'
import { useConversationPersistence } from '../hooks/useConversationPersistence'
import { useProgressTracker } from '../hooks/useProgressTracker'
import { sendMessage, MAX_RETRIES, prewarmConnection } from '../services/chatService'
import DeviceSelector from '../components/DeviceSelector'
import PronunciationCard from '../components/PronunciationCard'
import VoiceWaveform from '../components/VoiceWaveform'
import {
  playRecordStartSound,
  playRecordEndSound,
  playSendSound,
  playReceiveSound,
  playErrorSound,
} from '../utils/soundEffects'

const RETRY_DELAY = 2000

export default function ChatPage() {
  const { sceneId } = useParams()
  const navigate = useNavigate()
  const scene = getSceneById(sceneId)

  // 状态管理
  const { messages, setMessages, isRestored, clearConversation } = useConversationPersistence(sceneId)
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
  const messagesEndRef = useRef(null)
  const lastSentRef = useRef('')
  const sendingRef = useRef(false)
  // 流式响应控制器 — 用于取消正在进行的请求
  const abortRef = useRef(null)

  // Hooks
  const { isListening, transcript, interimText, isSupported, startListening, stopListening, setTranscript } = useSpeechRecognition()
  const { speak, stop: stopTTS } = useTTS()
  const { microphones, speakers, selectedMicId, selectedSpeakerId, setSelectedMicId, setSelectedSpeakerId, isDeviceReady, refreshDevices } = useAudioDevices()
  const { state: progressState, recordSession } = useProgressTracker()

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // ====== v3: 连接预暖 — 场景进入时预热 API 连接 ======
  useEffect(() => {
    prewarmConnection(sceneId)
  }, [sceneId])

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

    lastSentRef.current = trimmed
    sendingRef.current = true

    // 取消之前的流式请求
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }

    const userMsg = { role: 'user', content: trimmed }
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
        })

        // 流式结束，显示最终结果
        setIsStreaming(false)
        setStreamText('')

        const aiMsg = { role: 'assistant', ...result }
        setMessages(prev => [...prev, aiMsg])

        // TTS 播放 + 音效
        speak(result.reply, { outputDeviceId: selectedSpeakerId })
        if (result.corrections?.length > 0) setShowCorrections(true)
        playReceiveSound()

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
  }, [sceneId, messages, isLoading, selectedSpeakerId, retryCount])

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

  // 同步 transcript/interimText 到 ref（供 handlePointerUp 读取最新值）
  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { interimTextRef.current = interimText }, [interimText])

  function handlePointerDown(e) {
    e.preventDefault()
    if (isLoading) return
    isHoldingBtnRef.current = true
    stopTTS()
    startListening()
    playRecordStartSound()
  }

  function handlePointerUp() {
    if (!isHoldingBtnRef.current) return
    isHoldingBtnRef.current = false
    stopListening()
    playRecordEndSound()
    // 从 ref 读取最新文本，避免闭包陷阱
    const text = (transcriptRef.current || interimTextRef.current)?.trim() || ''
    setTranscript('')
    if (text) { playSendSound(); handleSend(text) }
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
    recordSession({
      sceneId,
      messageCount: messages.filter(m => m.role === 'user').length,
      corrections: allCorrections.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      scores,
      correctionTypes: allCorrections.map(c => c.type).filter(Boolean),
      correctionDetails: allCorrections.map(c => ({ original: c.original, corrected: c.corrected, type: c.type })),
    })
    // 保存本次会话到 sessionStorage 作为报告页备份（防止 navigate state 丢失）
    try {
      sessionStorage.setItem('ai-coach-last-session', JSON.stringify({ messages, scene, progressState }))
    } catch { /* ignore */ }
    navigate('/summary', { state: { messages, scene, progressState } })
    clearConversation()
  }

  if (!scene) return <div className="p-8 text-center text-slate-500">场景不存在</div>

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
          {/* 连续天数徽章 */}
          {progressState.streakDays >= 2 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
              🔥{progressState.streakDays}天
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <DeviceSelector {...{ microphones, speakers, selectedMicId, selectedSpeakerId, onMicChange: setSelectedMicId, onSpeakerChange: setSelectedSpeakerId, isDeviceReady, refreshDevices }} />
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
          return (
            <div key={idx}>
              <MessageBubble message={msg} onReplay={(t) => speak(t)} />
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

      {/* 底部输入区 */}
      <footer className="px-3 sm:px-4 pb-6 pt-2.5 bg-slate-900/80 backdrop-blur-md border-t border-white/5 safe-area-bottom max-w-3xl mx-auto w-full">
        {isListening && <VoiceWaveform isActive={isListening} color="#ef4444" />}

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
          <p className="text-center text-red-400/70 text-sm py-3">不支持语音识别，请使用 Chrome 或下方输入</p>
        ) : (
          <div className="flex justify-center">
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
              disabled={isLoading}
              data-listening={isListening || undefined}
              className={`mic-btn w-[72px] h-[72px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-white text-2xl
                shadow-lg cursor-pointer select-none relative touch-manipulation outline-none
                ${!isListening ? 'mic-btn-idle' : 'mic-btn-active'}
              `}
            >
              🎤
              {isListening && <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-2 mb-3">
          {isListening ? '🔴 松开发送' : '按住麦克风说话'}
          <span className="hidden sm:inline text-slate-600 ml-2">| 快捷键: Space 录音 / Esc 停止 / / 输入</span>
        </p>

        {/* 文字输入 */}
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
const MessageBubble = memo(function MessageBubble({ message, onReplay }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-2.5 sm:gap-3 message-enter ${isUser ? 'flex-row-reverse' : ''}`} role="article" aria-label={`${isUser ? '用户' : 'AI'}消息`}>
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0 shadow-lg
        ${isUser ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`} aria-hidden="true">
        {isUser ? '我' : 'AI'}
      </div>

      <div className={`max-w-[82%] sm:max-w-[75%] space-y-1.5`}>
        <div className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] leading-relaxed shadow-lg
          ${isUser ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-gray-100 rounded-tl-sm border border-white/5'}`}>
          {message.reply || message.content}
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
