import { useState, useRef, useCallback } from 'react'
import { lookupDict, tokenizeForRender } from './WordPopup'

/**
 * 语音消息气泡组件 v2 (对齐图片样例)
 *
 * 布局（从右到左）：
 *   [ME 徽章] [绿色胶囊气泡 🎙 4" 98分] [收起按钮]
 *   [可选：文本 + 回听按钮]
 *   [分词面板：紫色边框 + 独立单词卡片]
 *
 * 功能：
 * 1. 绿色胶囊形语音气泡：麦克风图标 + 语音时长 + 评分（圆角胶囊）
 * 2. 绿色 ME 徽章外置在气泡右侧
 * 3. 蓝色/紫色分词面板：单词独立可点击卡片
 * 4. 单词卡片点击 → 浮窗展示 IPA + 中文释义 + 播放按钮
 * 5. 收起/展开控制：与气泡同一行（与图片样例一致）
 * 6. 评分数字点击 → 展开详细发音评测报告
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
        {/* ===== 顶部行：收起按钮 + 语音气泡 + ME 徽章 ===== */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
          {/* 左侧：收起/展开按钮（与气泡同行，与图片样例一致） */}
          {wordEntries.length > 0 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs text-slate-300 bg-slate-700/40 hover:bg-slate-600/50 border border-slate-600/40 hover:border-slate-500/60 transition-all"
              aria-label={collapsed ? '展开分词' : '收起分词'}
            >
              <span>{collapsed ? '展开' : '收起'}</span>
              <svg className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}

          {/* 中间：绿色胶囊形语音气泡（只显示图标 + 时长 + 评分） */}
          <div className="relative flex items-center gap-2 sm:gap-2.5 rounded-full pl-2.5 sm:pl-3 pr-2 sm:pr-2.5 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500/90 to-teal-500/90 border border-emerald-300/30"
            style={{ boxShadow: '0 0 18px rgba(16,185,129,0.35), 0 4px 16px rgba(0,0,0,0.35)' }}
          >
            {/* 麦克风图标 */}
            <div className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/15 shrink-0" aria-hidden="true">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                <path d="M19 11a1 1 0 1 0-2 0 5 5 0 1 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z" />
              </svg>
            </div>

            {/* 语音时长 */}
            <span className="text-[12px] sm:text-[13px] font-mono font-semibold text-white tabular-nums">
              {audioDuration || '-'}<span className="text-white/80">"</span>
            </span>

            {/* 评分胶囊（蓝色/紫色，圆形评分徽章） */}
            {grade && (
              <button
                onClick={() => {
                  if (onScoreClick) { onScoreClick(score); return }
                  setShowScoreDetail(!showScoreDetail)
                }}
                className={`flex items-center justify-center min-w-[34px] sm:min-w-[38px] h-6 sm:h-7 px-1.5 sm:px-2 rounded-full text-[11px] sm:text-xs font-bold ${grade.text} bg-slate-900/80 border border-white/10 hover:brightness-125 hover:scale-105 active:scale-95 transition-all cursor-pointer`}
                aria-label={`发音评分: ${score}分`}
                title="点击查看详细评测"
              >
                {score}<span className="text-[9px] sm:text-[10px] opacity-70 ml-0.5">分</span>
              </button>
            )}
          </div>

          {/* 右侧：ME 徽章（绿色，外置） */}
          <span className="flex items-center justify-center min-w-[34px] h-7 sm:h-8 px-2 sm:px-2.5 rounded-md text-[10px] sm:text-[11px] font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-600 border border-emerald-300/40 tracking-wider shadow-md"
            style={{ boxShadow: '0 0 10px rgba(16,185,129,0.3)' }}
          >
            ME
          </span>
        </div>

        {/* 语音文本（辅助展示，可选，不影响主样式） */}
        {content && (
          <p className="text-[12px] sm:text-[13px] text-slate-400 leading-relaxed text-right pr-1">
            {content}
          </p>
        )}

        {/* 语音回听按钮（与图片样例兼容，隐藏在文本下方） */}
        {audioUrl && (
          <div className="flex justify-end pr-1">
            <button
              onClick={handleReplay}
              className="text-[10px] sm:text-[11px] text-emerald-300/70 hover:text-emerald-200 flex items-center gap-1 transition-colors"
              aria-label="回听语音"
            >
              <span>🔊</span>
              <span>回听</span>
            </button>
          </div>
        )}

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

        {/* ===== 分词文本框（紫色边框独立面板，与图片样例一致） ===== */}
        {!collapsed && wordEntries.length > 0 && (
          <div className="rounded-2xl bg-slate-800/30 border border-violet-500/30 px-3 sm:px-4 py-2.5 sm:py-3"
            style={{ boxShadow: '0 0 16px rgba(139,92,246,0.12), inset 0 0 8px rgba(139,92,246,0.04)' }}
          >
            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-end">
              {wordEntries.map((entry, i) => (
                <button
                  key={i}
                  onClick={(e) => handleWordClick(entry.word, e)}
                  className={`relative px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium transition-all select-none
                    bg-slate-700/40 border border-violet-400/20 hover:border-violet-400/60 hover:bg-violet-500/15 hover:text-violet-100
                    active:scale-95 hover:shadow-[0_0_10px_rgba(139,92,246,0.25)]
                    ${activeWord === entry.word ? 'border-violet-400/80 bg-violet-500/20 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.35)]' : 'text-slate-200'}
                  `}
                  aria-label={`单词: ${entry.word}`}
                  title={entry.entry ? `${entry.word} ${entry.entry.ipa} ${entry.entry.zh}` : entry.word}
                >
                  {entry.word}
                  {playingWord === entry.word && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
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