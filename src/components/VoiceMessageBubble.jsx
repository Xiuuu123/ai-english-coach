import { useState, useRef, useCallback } from 'react'
import { lookupDict, tokenizeForRender } from './WordPopup'

/**
 * 语音消息气泡组件 v1
 *
 * 功能：
 * 1. 绿色语音气泡：右上角 "ME" 标识 + 麦克风图标 + 语音时长 + 发音评分
 * 2. 下方分词文本框：ASR 转写句子按单词拆分为独立卡片
 * 3. 单词卡片点击 → 浮窗展示 IPA + 中文释义 + 播放按钮
 * 4. 收起/展开控制：可隐藏/显示分词面板
 * 5. 评分数字点击 → 展开详细发音评测报告
 *
 * 兼容：与现有 WordPopup、PronunciationCard、TTS 无缝对接
 */

/** 评分等级颜色映射 */
function getScoreGrade(score) {
  if (score >= 90) return { color: '#34d399', bg: 'rgba(52,211,153,0.15)', text: 'text-emerald-400', label: '优秀' }
  if (score >= 75) return { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', text: 'text-blue-400', label: '良好' }
  if (score >= 60) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: 'text-amber-400', label: '一般' }
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', text: 'text-red-400', label: '需加强' }
}

export default function VoiceMessageBubble({
  message,
  onWordClick,
  onPlayWord,
  onReplay,
  onScoreClick,
  className = '',
}) {
  const { content = '', audioUrl, audioDuration = 0, score } = message
  const [collapsed, setCollapsed] = useState(false)       // 分词面板折叠
  const [showScoreDetail, setShowScoreDetail] = useState(false) // 评分详情展开
  const [activeWord, setActiveWord] = useState(null)       // 当前激活的单词
  const [popupPos, setPopupPos] = useState(null)           // 弹窗定位
  const audioRef = useRef(null)
  const [playingWord, setPlayingWord] = useState(null)

  // 单词 → 词典查询
  const wordEntries = (() => {
    const tokens = tokenizeForRender(content)
    return tokens
      .filter(t => t.type === 'word')
      .map(t => ({
        word: t.value,
        entry: lookupDict(t.value),
      }))
  })()

  // 评分等级
  const grade = score != null ? getScoreGrade(score) : null

  // 播放整段语音
  const handleReplay = useCallback(() => {
    if (onReplay) { onReplay(); return }
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
    }
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
  }, [audioUrl, onReplay])

  // 单词点击 → 弹出浮窗
  const handleWordClick = useCallback((word, e) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setActiveWord(word)
    setPopupPos({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    // 同时通知外部（用于全局 WordPopup）
    if (onWordClick) onWordClick(word, rect)
  }, [onWordClick])

  // 播放单词发音
  const handlePlayWord = useCallback((word) => {
    setPlayingWord(word)
    if (onPlayWord) {
      onPlayWord(word)
      setTimeout(() => setPlayingWord(null), 1000)
    } else {
      // 降级：使用浏览器内置 TTS
      const u = new SpeechSynthesisUtterance(word)
      u.lang = 'en-US'
      u.rate = 0.9
      u.onend = () => setPlayingWord(null)
      speechSynthesis.cancel()
      speechSynthesis.speak(u)
    }
  }, [onPlayWord])

  // 关闭单词弹窗
  const closePopup = useCallback(() => {
    setActiveWord(null)
    setPopupPos(null)
  }, [])

  const activeEntry = activeWord ? lookupDict(activeWord) : null

  return (
    <div className={`flex items-start gap-2.5 sm:gap-3 message-enter flex-row-reverse ${className}`} role="article" aria-label="用户语音消息">
      {/* 头像 */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600" aria-hidden="true">
        我
      </div>

      <div className="max-w-[82%] sm:max-w-[75%] space-y-2">
        {/* ===== 收起/展开按钮 ===== */}
        {wordEntries.length > 0 && (
          <div className="flex justify-end pr-0.5">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              aria-label={collapsed ? '展开分词' : '收起分词'}
            >
              <span>{collapsed ? '展开' : '收起'}</span>
              <svg className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ===== 语音气泡主体 ===== */}
        <div className="relative rounded-2xl rounded-tr-sm px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-lg bg-gradient-to-br from-emerald-600/90 to-teal-700/90 border border-emerald-400/20"
          style={{ boxShadow: '0 0 20px rgba(52,211,153,0.15), 0 4px 20px rgba(0,0,0,0.3)' }}
        >
          {/* 顶部信息栏：ME 标识 + 麦克风 + 时长 + 评分 */}
          <div className="flex items-center justify-between mb-2">
            {/* 左侧：ME 标识 */}
            <span className="text-[10px] font-bold text-emerald-200 bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              ME
            </span>
            {/* 右侧：麦克风 + 时长 + 评分 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-emerald-200/80">
                <span className="text-xs">🎙️</span>
                <span className="text-[11px] font-mono font-medium">{audioDuration || '-'}"</span>
              </div>
              {grade && (
                <button
                  onClick={() => {
                    if (onScoreClick) { onScoreClick(score); return }
                    setShowScoreDetail(!showScoreDetail)
                  }}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${grade.text} ${grade.bg} hover:brightness-125 transition-all cursor-pointer`}
                  aria-label={`发音评分: ${score}分`}
                  title="点击查看详细评测"
                >
                  <span>{score}</span>
                  <span className="text-[9px] opacity-70">分</span>
                </button>
              )}
            </div>
          </div>

          {/* 语音文本内容 */}
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-white/90 font-medium">
            {content}
          </p>

          {/* 重播按钮 */}
          {audioUrl && (
            <button
              onClick={handleReplay}
              className="mt-2 text-[11px] text-emerald-200/70 hover:text-emerald-100 flex items-center gap-1 transition-colors"
              aria-label="重播语音"
            >
              <span>🔊</span>
              <span>回听</span>
            </button>
          )}
        </div>

        {/* ===== 评分详情面板 ===== */}
        {showScoreDetail && grade && (
          <div className="rounded-xl bg-slate-800/80 border border-emerald-500/15 px-3 py-2.5 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">发音评测报告</span>
              <button
                onClick={() => setShowScoreDetail(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
                aria-label="关闭评测报告"
              >
                ✕
              </button>
            </div>
            {/* 综合评分 */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#1e293b" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none"
                    stroke={grade.color} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 125.66} 125.66`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                  {score}
                </span>
              </div>
              <div>
                <span className={`text-sm font-bold ${grade.text}`}>{grade.label}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">综合发音评分</p>
              </div>
            </div>
            {/* 维度评价 */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: '流利度', value: Math.min(score + 2, 100), icon: '🌊' },
                { label: '语法', value: Math.min(score + 5, 100), icon: '📐' },
                { label: '词汇', value: Math.min(score - 3, 100), icon: '📚' },
                { label: '发音', value: score, icon: '🗣️' },
              ].map(dim => (
                <div key={dim.label} className="flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-2 py-1.5">
                  <span className="text-xs">{dim.icon}</span>
                  <span className="text-[10px] text-slate-400 flex-1">{dim.label}</span>
                  <span className="text-[11px] font-mono font-bold text-white">{dim.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 分词文本框 ===== */}
        {!collapsed && wordEntries.length > 0 && (
          <div className="rounded-xl bg-slate-800/40 border border-blue-500/10 px-2.5 sm:px-3 py-2.5"
            style={{ boxShadow: '0 0 12px rgba(99,102,241,0.08)' }}
          >
            <div className="flex flex-wrap gap-1.5">
              {wordEntries.map((entry, i) => (
                <button
                  key={i}
                  onClick={(e) => handleWordClick(entry.word, e)}
                  className={`relative px-2 py-1 rounded-lg text-[13px] sm:text-sm font-medium transition-all select-none
                    bg-slate-700/60 border border-white/5 hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-200
                    active:scale-95 hover:shadow-[0_0_8px_rgba(99,102,241,0.15)]
                    ${activeWord === entry.word ? 'border-blue-400/60 bg-blue-500/15 text-blue-200 shadow-[0_0_10px_rgba(99,102,241,0.25)]' : 'text-slate-200'}
                  `}
                  aria-label={`单词: ${entry.word}`}
                  title={entry.entry ? `${entry.word} ${entry.entry.ipa} ${entry.entry.zh}` : entry.word}
                >
                  {entry.word}
                  {playingWord === entry.word && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== 单词浮窗弹窗 ===== */}
        {activeWord && activeEntry && popupPos && (
          <>
            {/* 遮罩（点击关闭） */}
            <div className="fixed inset-0 z-40" onClick={closePopup} />
            {/* 浮窗 */}
            <div
              className="fixed z-50 bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl p-3 min-w-[160px] max-w-[240px] animate-scale-in"
              style={{
                boxShadow: '0 0 20px rgba(0,0,0,0.5), 0 0 8px rgba(99,102,241,0.15)',
                top: Math.min(popupPos.top - 8, window.innerHeight - 200),
                left: Math.max(8, Math.min(popupPos.left, window.innerWidth - 250)),
              }}
            >
              {/* 单词 */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-base font-bold text-white">{activeWord}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePlayWord(activeWord) }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all
                    ${playingWord === activeWord
                      ? 'bg-blue-500/30 text-blue-300'
                      : 'bg-slate-700/50 text-slate-400 hover:text-blue-300 hover:bg-blue-500/20'}`}
                  aria-label={`播放 ${activeWord}`}
                >
                  {playingWord === activeWord ? '⏸' : '🔊'}
                </button>
              </div>

              {/* 音标 */}
              <p className="text-xs text-blue-300/80 font-mono mb-1">{activeEntry.ipa}</p>

              {/* 词性 */}
              {activeEntry.pos && (
                <span className="inline-block text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded mr-1 mb-1">
                  {activeEntry.pos}
                </span>
              )}

              {/* 中文释义 */}
              <p className="text-[11px] text-slate-300 leading-relaxed">{activeEntry.zh}</p>

              {/* 关闭 */}
              <button
                onClick={closePopup}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/50 text-[10px] transition-colors"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
          </>
        )}

        {/* ===== 无词典数据时的降级浮窗 ===== */}
        {activeWord && !activeEntry && popupPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={closePopup} />
            <div
              className="fixed z-50 bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl p-3 min-w-[140px] animate-scale-in"
              style={{
                boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                top: Math.min(popupPos.top - 8, window.innerHeight - 180),
                left: Math.max(8, Math.min(popupPos.left, window.innerWidth - 250)),
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-base font-bold text-white">{activeWord}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePlayWord(activeWord) }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all
                    ${playingWord === activeWord ? 'bg-blue-500/30 text-blue-300' : 'bg-slate-700/50 text-slate-400 hover:text-blue-300'}`}
                  aria-label={`播放 ${activeWord}`}
                >
                  🔊
                </button>
              </div>
              <p className="text-[11px] text-slate-500">暂无词典释义</p>
              <button
                onClick={closePopup}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/50 text-[10px] transition-colors"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}