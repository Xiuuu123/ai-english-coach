import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSceneById } from '../data/scenes'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useTTS } from '../hooks/useTTS'
import { useAudioDevices } from '../hooks/useAudioDevices'
import { useConversationPersistence } from '../hooks/useConversationPersistence'
import { sendMessage, MAX_RETRIES } from '../services/chatService'
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

const RETRY_DELAY = 2000 // 重试等待时间(ms)

export default function ChatPage() {
  const { sceneId } = useParams()
  const navigate = useNavigate()
  const scene = getSceneById(sceneId)

  // 使用持久化的消息状态
  const { messages, setMessages, isRestored, clearConversation } = useConversationPersistence(sceneId)
  const [isLoading, setIsLoading] = useState(false)
  const [showCorrections, setShowCorrections] = useState(false)
  const [aiTypingText, setAiTypingText] = useState('')
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [error, setError] = useState(null) // 错误状态
  const [retryCount, setRetryCount] = useState(0) // 当前重试次数
  const [lastSpokenText, setLastSpokenText] = useState('') // 最后一次说的话（用于发音评测）
  const messagesEndRef = useRef(null)
  const lastSentRef = useRef('')
  const sendingRef = useRef(false)

  const { isListening, transcript, interimText, isSupported, startListening, stopListening, setTranscript } = useSpeechRecognition()
  const { speak, stop: stopTTS } = useTTS()
  const {
    microphones,
    speakers,
    selectedMicId,
    selectedSpeakerId,
    setSelectedMicId,
    setSelectedSpeakerId,
    isDeviceReady,
    refreshDevices,
  } = useAudioDevices()

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTypingText])

  // 打字机效果
  function typeWriter(text, callback) {
    setIsAiTyping(true)
    setAiTypingText('')
    let i = 0
    const speed = 20 + Math.random() * 15

    function type() {
      if (i < text.length) {
        setAiTypingText(text.substring(0, i + 1))
        i++
        setTimeout(type, speed)
      } else {
        setIsAiTyping(false)
        setAiTypingText('')
        if (callback) callback()
      }
    }
    type()
  }

  // 发送消息给 AI（带去重 + 重试）
  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || sendingRef.current) return

    if (trimmed === lastSentRef.current) return
    lastSentRef.current = trimmed
    sendingRef.current = true
    setLastSpokenText(trimmed) // 保存用于发音评测

    const userMsg = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    let attempt = 0
    let lastError = null

    while (attempt <= retryCount) {
      try {
        const history = [...messages.slice(-20), userMsg].map(m => ({
          role: m.role,
          content: m.role === 'assistant' ? (m.reply || '') : (m.content || ''),
        }))

        const result = await sendMessage(sceneId, history)
        const aiMsg = { role: 'assistant', ...result }

        // 打字机效果展示 AI 回复
        typeWriter(result.reply || '', () => {
          setMessages(prev => [...prev, aiMsg])
          speak(result.reply, { outputDeviceId: selectedSpeakerId })
          if (result.corrections?.length > 0) setShowCorrections(true)
          playReceiveSound() // AI 回复到达音效
        })

        sendingRef.current = false
        setIsLoading(false)
        setTranscript('')
        return

      } catch (err) {
        lastError = err
        attempt++
        if (attempt <= retryCount) {
          // 等待后自动重试
          await new Promise(r => setTimeout(r, RETRY_DELAY))
        }
      }
    }

    // 所有重试都失败
    console.error('All retries failed:', lastError)
    playErrorSound()
    typeWriter(`连接失败: ${lastError?.message || '网络异常'}。请检查网络后重试。`, () => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', reply: `连接失败: ${lastError?.message || '网络异常'}`, corrections: [], pronunciationTips: [], score: null },
      ])
      setError(lastError?.message || '网络异常')
    })
    sendingRef.current = false
    setIsLoading(false)
    setTranscript('')
  }, [sceneId, messages, isLoading, selectedSpeakerId, setMessages, retryCount])

  /** 手动重试 */
  function handleRetry() {
    if (error && !isLoading) {
      setError(null)
      // 取最后一条用户消息重新发送
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
      if (lastUserMsg) {
        lastSentRef.current = '' // 清除去重缓存，允许重发
        handleSend(lastUserMsg.content)
      }
    }
  }

  // 录音按钮事件（带音效）
  function handlePointerDown(e) {
    e.preventDefault()
    startListening()
    playRecordStartSound()
  }

  function handlePointerUp() {
    stopListening()
    playRecordEndSound()
    const text = (transcript || interimText)?.trim() || ''
    setTranscript('')
    if (text) {
      playSendSound()
      handleSend(text)
    }
  }

  // 结束练习
  function handleFinish() {
    stopTTS()
    clearConversation()
    navigate('/summary', { state: { messages, scene } })
  }

  if (!scene) return <div className="p-8 text-center text-slate-500">场景不存在</div>

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-30">
        <button onClick={() => { stopTTS(); clearConversation(); navigate('/') }}
          className="text-indigo-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
          ← 返回
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base sm:text-lg">{scene.icon}</span>
          <span className="font-semibold text-white text-sm sm:text-base hidden sm:inline">{scene.name}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <DeviceSelector {...{ microphones, speakers, selectedMicId, selectedSpeakerId, onMicChange: setSelectedMicId, onSpeakerChange: setSelectedSpeakerId, isDeviceReady, refreshDevices }} />
          <button onClick={handleFinish}
            className="text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors active:scale-95">
            结束练习
          </button>
        </div>
      </header>

      {/* 消息列表区域 */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 pb-safe">
        {/* 加载中（恢复对话） */}
        {!isRestored && (
          <ChatSkeleton />
        )}

        {/* 欢迎消息 */}
        {isRestored && messages.length === 0 && !isLoading && (
          <WelcomeCard scene={scene} onStart={() => handleSend('Hello! I am ready to practice.')} />
        )}

        {/* 消息渲染 */}
        {isRestored && messages.map((msg, idx) => {
          const isLastUser = msg.role === 'user' && idx === messages.length - 1
            || (msg.role === 'user' && messages[idx + 1]?.role !== 'user')
          return (
            <div key={idx}>
              <MessageBubble message={msg} onReplay={(t) => speak(t)} />
              {/* 用户消息后显示发音评测卡片 */}
              {isLastUser && msg.role === 'user' && msg.content && (
                <PronunciationCard spokenText={msg.content} />
              )}
            </div>
          )
        })}

        {/* AI 打字机效果 / 加载动画 */}
        {(isAiTyping || isLoading) && (
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0 shadow-lg">
              AI
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-3.5 sm:px-4 py-2.5 sm:py-3 border border-white/5 max-w-[85%] sm:max-w-[75%]">
              {isAiTyping && aiTypingText ? (
                <p className="text-[14px] sm:text-[15px] text-gray-200 leading-relaxed">
                  {aiTypingText}
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

        {/* 错误提示 + 重试按钮 */}
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

      {/* 纠错面板 */}
      {isRestored && messages.some(m => m.corrections?.length > 0) && (
        <CorrectionPanel
          isOpen={showCorrections}
          onToggle={() => setShowCorrections(!showCorrections)}
          latestCorrections={[...messages].reverse().find(m => m.corrections?.length > 0)?.corrections || []}
        />
      )}

      {/* 底部输入区 - 移动端安全区域 */}
      <footer className="px-3 sm:px-4 pb-6 pt-2.5 bg-slate-900/80 backdrop-blur-md border-t border-white/5 safe-area-bottom">
        {/* 语音波形（录音时显示） */}
        {isListening && (
          <VoiceWaveform isActive={isListening} color="#ef4444" />
        )}

        {/* 实时识别文字 */}
        {(transcript || interimText) && (
          <div className={`text-center text-xs sm:text-sm px-3 sm:px-4 py-1.5 mx-auto max-w-md rounded-xl mb-2 truncate ${
            interimText ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
          }`}>
            {interimText ? interimText : `"${transcript}"`}
          </div>
        )}

        {/* 麦克风按钮 - 移动端加大触控区域 */}
        {!isSupported ? (
          <p className="text-center text-red-400/70 text-sm py-3">不支持语音识别，请使用 Chrome 或下方输入</p>
        ) : (
          <div className="flex justify-center">
            <button
              onMouseDown={handlePointerDown}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={(e) => { e.preventDefault(); handlePointerDown(e) }}
              onTouchEnd={(e) => { e.preventDefault(); handlePointerUp() }}
              disabled={isLoading}
              className={`w-[72px] h-[72px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-white text-2xl
                shadow-lg active:scale-95 transition-all duration-200 cursor-pointer select-none relative touch-manipulation
                ${isListening
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/40 shadow-2xl scale-105'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:shadow-indigo-500/30 hover:shadow-xl hover:scale-105'
                }`}
            >
              🎤
              {isListening && (
                <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
              )}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-2 mb-3">
          {isListening ? '🔴 松开发送' : '按住麦克风说话'}
        </p>

        {/* 文字输入 */}
        <div className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            placeholder="或者直接输入英文..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                playSendSound()
                handleSend(e.target.value); e.target.value = ''
              }
            }}
            className="flex-1 text-sm bg-slate-800 border border-white/10 rounded-xl px-3.5 sm:px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent"
          />
          <button
            onClick={(e) => {
              const input = e.target.parentElement.querySelector('input')
              if (input?.value.trim()) {
                playSendSound()
                handleSend(input.value); input.value = ''
              }
            }}
            disabled={isLoading}
            className="px-4 sm:px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors active:scale-95"
          >
            发送
          </button>
        </div>
      </footer>
    </div>
  )
}

/** 骨架屏加载状态 */
function ChatSkeleton() {
  return (
    <div className="space-y-4 py-6 animate-fade-in">
      {[1, 2, 3].map(i => (
        <div key={i} className={`flex items-start gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-slate-800 shimmer" />
          <div className={`max-w-[70%] space-y-2 ${i % 2 === 0 ? 'items-end' : ''}`}>
            <div className="h-12 sm:h-14 bg-slate-800 rounded-2xl shimmer w-full" />
            <div className="h-3 bg-slate-800/60 rounded shimmer w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** 欢迎引导卡片 */
function WelcomeCard({ scene, onStart }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-16 animate-fade-in">
      <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br ${scene.color} flex items-center justify-center text-4xl sm:text-5xl shadow-2xl mb-5 sm:mb-6`}>
        {scene.icon}
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
        准备好开始了吗？
      </h2>
      <p className="text-slate-400 max-w-sm mx-auto text-center leading-relaxed mb-7 sm:mb-8 text-sm sm:text-base">
        你正在进入 <span className="text-indigo-400 font-medium">{scene.nameEn}</span> 场景。
        按住下方麦克风开始与 AI 进行英语对话练习。
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-sm">
        <button
          onClick={() => { playSendSound(); onStart() }}
          className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:-translate-y-0.5 active:scale-97"
        >
          🎤 开始对话
        </button>
        <button
          onClick={() => { playSendSound(); onStart() }}
          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all hover:-translate-y-0.5 border border-white/5 active:scale-97"
        >
          ⌨️ 文字输入
        </button>
      </div>
    </div>
  )
}

/** 消息气泡组件 */
function MessageBubble({ message, onReplay }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-2.5 sm:gap-3 message-enter ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0 shadow-lg
        ${isUser ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}
      >
        {isUser ? '我' : 'AI'}
      </div>

      {/* 内容区 */}
      <div className={`max-w-[82%] sm:max-w-[75%] space-y-1.5`}>
        <div className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] leading-relaxed shadow-lg
          ${isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-slate-800 text-gray-100 rounded-tl-sm border border-white/5'
          }`}
        >
          {message.reply || message.content}
        </div>

        {isUser && message.content && (
          <p className="text-[11px] text-slate-500 text-right pr-0.5 hidden sm:block">{message.content}</p>
        )}

        {/* AI 消息附加信息栏 */}
        {!isUser && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-0.5 pt-0.5 flex-wrap">
            {message.score !== null && <ScoreRing score={message.score} />}
            <button onClick={() => onReplay(message.reply)}
              className="text-[11px] sm:text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors">
              🔊 重播
            </button>
            {message.corrections?.length > 0 && (
              <span className="text-[11px] sm:text-xs text-orange-400 font-medium flex items-center gap-0.5">
                🔧 {message.corrections.length}处纠正
              </span>
            )}
          </div>
        )}

        {/* 纠错内联展示 */}
        {!isUser && message.corrections?.length > 0 && (
          <div className="space-y-1.5 pl-0.5 flex flex-wrap gap-1.5">
            {message.corrections.map((c, i) => (
              <div key={i} className="inline-flex items-center gap-1 bg-orange-500/10 border border-orange-500/15 rounded-lg px-2 py-1 text-[11px] sm:text-xs">
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
}

/** 评分环形动画 */
function ScoreRing({ score }) {
  const s = score || 0
  const color = s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444'
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (s / 100) * circumference

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold">
      <svg width="28" height="28" viewBox="0 0 28 28" className="animate-score-in">
        <circle cx="14" cy="14" r={radius} fill="none" stroke="#334155" strokeWidth="3" />
        <circle cx="14" cy="14" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text x="14" y="14" dominantBaseline="central" textAnchor="middle"
          fontSize="8.5" fontWeight="bold" fill={color}>
          {s}
        </text>
      </svg>
    </span>
  )
}

/** 可折叠纠错面板 */
function CorrectionPanel({ isOpen, onToggle, latestCorrections }) {
  return (
    <div className="mx-3 sm:mx-4 mb-2 bg-slate-800/80 backdrop-blur-sm border border-orange-500/15 rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="font-semibold text-orange-400 text-sm flex items-center gap-1.5">
          🔧 实时纠错 ({latestCorrections.length})
        </span>
        <svg className={`w-4 h-4 text-orange-400/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {latestCorrections.map((c, i) => (
            <div key={i} className="bg-slate-900/60 rounded-xl p-3 border border-white/5">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <span className="text-red-400 line-through bg-red-500/10 px-2 py-0.5 rounded">{c.original}</span>
                <span className="text-green-400 font-medium shrink-0">→</span>
                <span className="text-green-300 font-medium bg-green-500/10 px-2 py-0.5 rounded">{c.corrected}</span>
              </div>
              {c.tip && (
                <p className="mt-1.5 text-[11px] sm:text-xs text-slate-400 pl-0.5 flex items-start gap-1">
                  <span>💡</span>{c.tip}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}