import { useState, useMemo, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { analyzePronunciation } from '../utils/pronunciation'
import { useProgressTracker } from '../hooks/useProgressTracker'

/** 获取全局趋势方向 */
function getGlobalTrend(state) {
  if (!state?.scoreHistory || state.scoreHistory.length < 3) return 'stable'
  const h = state.scoreHistory
  const recent = h.slice(-3).reduce((a, b) => a + b.score, 0) / 3
  const older = h.slice(-6, -3).length ? h.slice(-6, -3).reduce((a, b) => a + b.score, 0) / h.slice(-6, -3).length : recent
  if (recent > older + 3) return 'up'
  if (recent < older - 3) return 'down'
  return 'stable'
}

/** 错误类型归一化（英文 type key → 中文 label） */
const ERROR_TYPE_META = {
  grammar:        { label: '语法错误', icon: '📝', short: '语法' },
  vocabulary:     { label: '用词不当', icon: '🔤', short: '用词' },
  pronunciation:  { label: '发音问题', icon: '🔊', short: '发音' },
  expression:     { label: '表达不自然', icon: '💬', short: '表达' },
  chinglish:      { label: '中式英语', icon: '🇨🇳', short: '中式' },
  other:          { label: '其他错误', icon: '⚠️', short: '其他' },
}

/** 等级评估：分数 → 标签 + 颜色 */
function getLevel(score) {
  if (score == null) return { label: '—', color: '#999' }
  if (score >= 85) return { label: 'C1 高级', color: '#9C27B0' }
  if (score >= 70) return { label: 'B2 中级', color: '#4F8BFF' }
  if (score >= 55) return { label: 'B1 初级', color: '#4CAF50' }
  return { label: 'A2 入门', color: '#FF9800' }
}

export default function SummaryPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // 优先从 location.state 读取，丢失时回退到 sessionStorage
  const stateData = (() => {
    if (location.state?.messages?.length) return location.state
    try {
      const saved = sessionStorage.getItem('ai-coach-last-session')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.messages?.length) return parsed
      }
    } catch { /* ignore */ }
    return {}
  })()
  const { messages = [], scene, progressState } = stateData

  // v4: 错误详情弹窗状态
  const [errorModalType, setErrorModalType] = useState(null)

  // v3: 获取跨会话分析数据
  const { getRepeatErrors, getWordBankList, getWeakAreaAnalysis } = useProgressTracker()
  const repeatErrors = useMemo(() => getRepeatErrors(), [getRepeatErrors])
  const wordBankList = useMemo(() => getWordBankList(), [getWordBankList])
  const weakAreaAnalysis = useMemo(() => getWeakAreaAnalysis(), [getWeakAreaAnalysis])

  // ===== useMemo: 缓存所有计算量大的派生数据（messages 不变时零重算）=====
  const computed = useMemo(() => {
    // 本次会话统计
    const userMessages = messages.filter(m => m.role === 'user')
    const aiMessages = messages.filter(m => m.role === 'assistant')
    const allCorrections = aiMessages.flatMap(m => m.corrections || [])
    const scores = aiMessages.filter(m => m.score != null).map(m => m.score)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    // 多维度评分聚合
    const dimensionScores = { fluency: [], grammar: [], vocabulary: [], pronunciation: [], confidence: [] }
    aiMessages.forEach(m => {
      if (m.dimensions) {
        Object.entries(dimensionScores).forEach(([dim, arr]) => {
          if (m.dimensions[dim] != null && !isNaN(Number(m.dimensions[dim]))) {
            arr.push(Number(m.dimensions[dim]))
          }
        })
      }
    })
    const avgDimensions = {}
    Object.entries(dimensionScores).forEach(([dim, vals]) => {
      if (vals.length > 0) avgDimensions[dim] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    })

    // 错误类型分布
    const errorTypes = { grammar: 0, vocabulary: 0, pronunciation: 0, expression: 0, other: 0 }
    allCorrections.forEach(c => {
      const t = c.type || 'other'
      errorTypes[t] = (errorTypes[t] || 0) + 1
    })
    Object.keys(errorTypes).forEach(k => { if (errorTypes[k] === 0) delete errorTypes[k] })
    const maxErrorCount = Math.max(...Object.values(errorTypes), 1)

    // 得分趋势数据
    const scoreTrend = scores.map((s, i) => ({ round: i + 1, score: s }))

    // 总词数估算
    const totalWords = userMessages.reduce((sum, m) => sum + (m.content ? m.content.split(/\s+/).filter(w => w).length : 0), 0)

    // 唯一错误短语数
    const uniqueErrors = [...new Set(allCorrections.map(c => c.original))].length

    // 最高分和最低分
    const maxScore = Math.max(...scores, 0)
    const minScore = Math.min(...scores, 100)
    const scoreImprovement = scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0

    // 发音专项分析
    const pronunciationAnalyses = userMessages.map(m => analyzePronunciation(m.content)).filter(p => p.wordAnalysis.length > 0)
    const avgPronunciationScore = pronunciationAnalyses.length > 0
      ? Math.round(pronunciationAnalyses.reduce((s, p) => s + p.overallScore, 0) / pronunciationAnalyses.length)
      : null

    // 难词掌握情况
    const difficultWordsFound = pronunciationAnalyses.flatMap(p => p.difficultyWordsFound)
    const uniqueDifficultWords = [...new Map(difficultWordsFound.map(w => [w.word, w])).values()]

    // 能力雷达图
    const radarData = [
      { label: '流利度', value: avgDimensions.fluency ?? (avgScore ? Math.min(100, avgScore + 5) : 72) },
      { label: '语法', value: avgDimensions.grammar ?? (avgScore ? Math.max(40, avgScore - (errorTypes.grammar || 0) * 3) : 68) },
      { label: '词汇量', value: avgDimensions.vocabulary ?? Math.min(95, 55 + totalWords / 3) },
      { label: '发音', value: avgDimensions.pronunciation ?? (avgPronunciationScore || (avgScore ? Math.max(50, avgScore - 8) : 65)) },
      { label: '自信度', value: avgDimensions.confidence ?? Math.min(95, 60 + userMessages.length * 3) },
    ]

    return {
      userMessages, allCorrections, scores, avgScore,
      avgDimensions, errorTypes, maxErrorCount,
      scoreTrend, totalWords, uniqueErrors,
      maxScore, minScore, scoreImprovement,
      pronunciationAnalyses, avgPronunciationScore,
      uniqueDifficultWords, radarData,
    }
  }, [messages])

  // 跨会话进度数据（轻量计算，无需 useMemo）
  const totalSessions = progressState?.totalSessions || 0
  const globalAvgScore = progressState?.averageScore || 0
  const streakDays = progressState?.streakDays || 0
  const milestones = progressState?.milestones || []
  const globalTrend = getGlobalTrend(progressState)

  if (!messages.length) return <EmptyState navigate={navigate} />

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header — 借鉴 report 原型，加入分数环 */}
      <header className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-10 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        </div>
        <div className="relative max-w-2xl mx-auto flex items-center gap-6">
          {/* 综合得分环（v4: 借鉴 report 原型） */}
          <div className="shrink-0">
            <ScoreRing score={computed.avgScore} size={104} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 text-sm text-white/70">
              <span className="font-medium">练习报告</span>
              <span className="text-white/40">|</span>
              <span>{new Date().toLocaleDateString('zh-CN')}</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5 truncate">
              <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-xl shrink-0">
                {scene?.icon}
              </span>
              <span className="truncate">{scene?.name} 总结</span>
            </h1>
            {/* 等级标签 */}
            {computed.avgScore != null && (() => {
              const lv = getLevel(computed.avgScore)
              return (
                <span
                  className="inline-block mt-2 px-3 py-0.5 text-xs font-medium rounded-full"
                  style={{ border: `1px solid ${lv.color}`, color: lv.color, background: 'rgba(255,255,255,0.1)' }}
                >
                  {lv.label}
                </span>
              )
            })()}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard icon="💬" label="对话轮数" value={computed.userMessages.length} color="from-blue-500/20 to-blue-600/20" border="border-blue-500/20" />
          <StatCard icon="⭐" label="平均得分" value={computed.avgScore ?? '--'} color="from-yellow-500/20 to-orange-500/20" border="border-yellow-500/20" highlight={computed.avgScore >= 80} />
          <StatCard icon="🔧" label="纠正次数" value={computed.allCorrections.length} color="from-orange-500/20 to-red-500/20" border="border-orange-500/20" />
          <StatCard icon="📝" label="总词数" value={computed.totalWords} color="from-emerald-500/20 to-teal-500/20" border="border-emerald-500/20" />
        </div>

        {/* v2: 跨会话学习进度 */}
        {totalSessions > 0 && (
          <section className="bg-gradient-to-br from-indigo-950/80 to-purple-950/40 rounded-2xl p-5 border border-indigo-500/10">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              📊 学习进度
            </h2>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-indigo-300">{totalSessions}</div>
                <div className="text-[11px] text-slate-400">累计练习</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${globalTrend === 'up' ? 'text-green-400' : globalTrend === 'down' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {globalAvgScore}
                  {globalTrend !== 'stable' && (
                    <span className="text-sm ml-0.5">{globalTrend === 'up' ? '↑' : '↓'}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">历史均分</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">{streakDays}天</div>
                <div className="text-[11px] text-slate-400">连续练习</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-300">{progressState?.totalCorrections || 0}</div>
                <div className="text-[11px] text-slate-400">总纠错</div>
              </div>
            </div>
            {/* 成就徽章 */}
            {milestones.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {milestones.map(m => {
                  const badgeInfo = {
                    first_session: { icon: '🎯', label: '首次练习', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
                    'score_80+': { icon: '🏆', label: '高分达成', bg: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' },
                    '10_messages': { icon: '💪', label: '积极对话', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
                    streak_3: { icon: '🔥', label: '坚持3天', bg: 'bg-orange-500/15 text-orange-300 border-orange-500/20' },
                  }[m] || { icon: '⭐', label: m, bg: 'bg-slate-500/15 text-slate-300 border-slate-500/20' }
                  return (
                    <span key={m} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeInfo.bg}`}>
                      {badgeInfo.icon} {badgeInfo.label}
                    </span>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* 得分趋势图 */}
        {computed.scores.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white flex items-center gap-2">
                📈 得分趋势
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {computed.minScore !== computed.maxScore && (
                  <span className={computed.scoreImprovement >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {computed.scoreImprovement >= 0 ? '↑' : '↓'} {Math.abs(computed.scoreImprovement)}分
                  </span>
                )}
                <span>最高 {computed.maxScore} · 最低 {computed.minScore}</span>
              </div>
            </div>
            {/* CSS 柱状图 */}
            <div className="flex items-end gap-2 h-36 px-2">
              {computed.scoreTrend.map((item, i) => {
                const heightPercent = Math.max(item.score, 5)
                const isLast = i === computed.scoreTrend.length - 1
                const barColor = item.score >= 80 ? '#22c55e' : item.score >= 60 ? '#eab308' : '#ef4444'
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold" style={{ color: barColor }}>{item.score}</span>
                    <div className="w-full relative" style={{ height: '100%' }}>
                      <div
                        className={`w-full rounded-t-md transition-all duration-700 ease-out ${isLast ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                        style={{
                          height: `${heightPercent}%`,
                          background: `linear-gradient(to top, ${barColor}, ${barColor}88)`,
                          minHeight: '8px',
                          animation: `barGrow 0.7s ${i * 0.1}s ease-out both`,
                        }}
                        title={`第${item.round}轮: ${item.score}分`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{item.round}</span>
                  </div>
                )
              })}
            </div>
            {/* 分数区间参考线 */}
            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[10px] text-slate-500">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </section>
        )}

        {/* 能力雷达图 */}
        <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
          <h2 className="font-bold text-white mb-5 flex items-center gap-2">
            🎯 能力评估
          </h2>
          <div className="flex justify-center">
            <RadarChart data={computed.radarData} size={220} />
          </div>
          {/* 维度说明 */}
          <div className="grid grid-cols-5 gap-1 mt-4">
            {computed.radarData.map((d, i) => (
              <div key={i} className="text-center">
                <div className="text-[11px] font-bold" style={{ color: RADAR_COLORS[i] }}>{d.value}</div>
                <div className="text-[10px] text-slate-500">{d.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 发音专项分析 */}
        {computed.pronunciationAnalyses.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white flex items-center gap-2">🗣️ 发音专项</h2>
              {computed.avgPronunciationScore != null && (
                <span className={`text-sm font-bold ${computed.avgPronunciationScore >= 80 ? 'text-green-400' : computed.avgPronunciationScore >= 60 ? 'text-yellow-400' : 'text-orange-400'}`}>
                  平均 {computed.avgPronunciationScore}分
                </span>
              )}
            </div>

            {/* 难词掌握 */}
            {computed.uniqueDifficultWords.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">高级词汇使用 ({computed.uniqueDifficultWords.length}个)</p>
                <div className="flex flex-wrap gap-1.5">
                  {computed.uniqueDifficultWords.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs border border-cyan-500/15">
                      {w.word}
                      <span className="text-[9px] opacity-50">{w.ipa}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 发音趋势 */}
            {computed.pronunciationAnalyses.length > 1 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">发音得分趋势</p>
                <div className="flex items-end gap-1 h-16">
                  {computed.pronunciationAnalyses.map((p, i) => {
                    const h = Math.max(p.overallScore * 0.14, 8)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-medium" style={{ color: p.overallScore >= 80 ? '#22c55e' : p.overallScore >= 70 ? '#eab308' : '#f97316' }}>{p.overallScore}</span>
                        <div
                          className="w-full rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${h}px`,
                            background: `linear-gradient(to top, ${p.overallScore >= 80 ? '#22c55e' : p.overallScore >= 70 ? '#eab308' : '#f97316'}, ${p.overallScore >= 80 ? '#22c55e88' : p.overallScore >= 70 ? '#eab30888' : '#f9731688'})`,
                            animation: `barGrow 0.5s ${i * 0.08}s ease-out both`,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===== v4: 错误分析 — 3 卡片式（借鉴 report 原型），点击弹出详情 ===== */}
        {computed.allCorrections.length > 0 && (() => {
          // 把英文 type key 转换为卡片（去重为 3 类）
          const errorMap = { grammar: 0, chinglish: 0, vocabulary: 0, expression: 0, pronunciation: 0, other: 0 }
          computed.allCorrections.forEach(c => {
            const t = c.type || 'other'
            errorMap[t] = (errorMap[t] || 0) + 1
          })
          // 选 top3 错误类型
          const top3 = Object.entries(errorMap)
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type, count]) => ({ type, count, meta: ERROR_TYPE_META[type] || ERROR_TYPE_META.other }))

          if (top3.length === 0) return null
          return (
            <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">🔍 错误分析</h2>
              <div className="flex gap-3">
                {top3.map(({ type, count, meta }) => (
                  <button
                    key={type}
                    onClick={() => setErrorModalType(type)}
                    className="flex-1 rounded-xl p-3 text-center transition-all duration-150 active:scale-[0.96] hover:brightness-110"
                    style={{ background: 'rgba(79,139,255,0.08)', border: '1px solid rgba(79,139,255,0.15)' }}
                    aria-label={`查看${meta.label}详情`}
                  >
                    <div className="text-2xl mb-1">{meta.icon}</div>
                    <div className="text-[11px] font-medium text-slate-200">{meta.label}</div>
                    <div className="text-xl font-bold text-indigo-300 mt-0.5">{count}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">查看详情 →</div>
                  </button>
                ))}
              </div>
            </section>
          )
        })()}

        {/* ===== v4: 表达优化 — 原始 vs 优化对比（借鉴 report 原型） ===== */}
        {computed.allCorrections.length > 0 && (() => {
          const examples = [...new Map(computed.allCorrections.map(c => [c.original + '|' + c.corrected, c])).values()].slice(0, 5)
          if (examples.length === 0) return null
          return (
            <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
              <h2 className="font-bold text-white mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">✨ 表达优化</span>
                <span className="text-xs font-normal text-slate-400">共 {examples.length} 条建议</span>
              </h2>
              <div className="space-y-2.5">
                {examples.map((c, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3.5 border border-white/5">
                    <div className="text-[12px] text-red-300">
                      <span className="font-medium text-red-400">原始：</span>{c.original}
                    </div>
                    <div className="flex justify-center my-1 text-slate-500 text-xs">↓</div>
                    <div className="text-[12px] text-green-300">
                      <span className="font-medium text-green-400">优化：</span>{c.corrected}
                    </div>
                    {c.tip && (
                      <div className="text-[10px] text-slate-500 mt-1">💡 {c.tip}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        {/* ===== v3: 弱点领域分析 + 改进建议 ===== */}
        {weakAreaAnalysis.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              🎯 弱点分析
            </h2>
            <div className="space-y-3">
              {weakAreaAnalysis.map((area, i) => (
                <div key={i} className="bg-slate-800/60 rounded-xl p-3.5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                      {area.icon} {area.label}
                    </span>
                    <span className="text-xs text-slate-400">{area.count}次 · {area.percent}%</span>
                  </div>
                  {/* 占比进度条 */}
                  <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-500/80 to-orange-400/80 transition-all duration-1000"
                      style={{ width: `${area.percent}%`, animation: 'barGrow 0.8s ease-out both' }} />
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-start gap-1">
                    <span>💡</span> {area.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== v3: 词汇银行 — 高频错误词汇 ===== */}
        {wordBankList.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h2 className="font-bold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">📚 词汇银行</span>
              <span className="text-xs font-normal text-slate-400">{wordBankList.length}个词汇</span>
            </h2>
            <div className="space-y-2">
              {wordBankList.slice(0, 8).map((item, i) => {
                const typeColors = {
                  grammar: 'border-purple-500/20 bg-purple-500/5',
                  vocabulary: 'border-blue-500/20 bg-blue-500/5',
                  pronunciation: 'border-green-500/20 bg-green-500/5',
                  expression: 'border-amber-500/20 bg-amber-500/5',
                }
                const typeBorder = typeColors[item.type] || 'border-slate-500/20 bg-slate-500/5'
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${typeBorder}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 line-through text-sm">{item.word}</span>
                      <span className="text-green-400 text-xs">→</span>
                      <span className="text-green-300 text-sm font-medium">{item.correct}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded-full">
                      {item.count}次
                    </span>
                  </div>
                )
              })}
              {wordBankList.length > 8 && (
                <p className="text-center text-xs text-slate-500 pt-1">+{wordBankList.length - 8} 更多词汇</p>
              )}
            </div>
          </section>
        )}

        {/* ===== v3: 重复错误检测 ===== */}
        {repeatErrors.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-amber-500/10">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              ⚠️ 重复错误
            </h2>
            <p className="text-xs text-slate-400 mb-3">以下错误在多轮练习中重复出现，需重点关注：</p>
            <div className="space-y-2">
              {repeatErrors.map((err, i) => (
                <div key={i} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-red-400 line-through text-sm">{err.original}</span>
                    <span className="text-green-400 text-xs">→</span>
                    <span className="text-green-300 text-sm font-medium">{err.corrected}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded-full">
                      {err.type?.slice(0, 3) || 'oth'}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {err.count}次
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 对话回顾 */}
        <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            🗣️ 对话回顾
          </h2>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 text-sm ${msg.role === 'user' ? 'justify-end' : ''}`}>
                <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px]
                  ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  {msg.role === 'user' ? '我' : 'AI'}
                </span>
                <span className={`max-w-[75%] px-3 py-2 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600/90 text-white rounded-tr-sm'
                    : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.reply || msg.content}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 操作按钮 */}
        <div className="flex gap-4 pb-8 pt-2">
          <button onClick={() => navigate('/')} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all">
            再练一次
          </button>
          <button onClick={() => window.print()} className="px-6 py-3.5 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 active:scale-[0.98] transition-all">
            打印报告
          </button>
        </div>
      </main>

      {/* ===== v4: 错误详情弹窗（借鉴 report 原型） ===== */}
      {errorModalType && (() => {
        const meta = ERROR_TYPE_META[errorModalType] || ERROR_TYPE_META.other
        const items = computed.allCorrections.filter(c => (c.type || 'other') === errorModalType)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setErrorModalType(null) }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="errorModalTitle"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-[340px] max-w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 id="errorModalTitle" className="text-white font-semibold text-base flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span> {meta.label}（{items.length}处）
                </h3>
                <button
                  onClick={() => setErrorModalType(null)}
                  className="text-slate-400 hover:text-white w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg leading-none"
                  aria-label="关闭"
                >✕</button>
              </div>
              {items.length === 0 ? (
                <p className="text-slate-400 text-sm">暂无此类错误</p>
              ) : (
                <div className="space-y-3">
                  {items.map((c, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-red-400 line-through bg-red-500/10 px-2 py-0.5 rounded text-[12px]">{c.original}</span>
                        <span className="text-green-400 text-xs">→</span>
                        <span className="text-green-300 bg-green-500/10 px-2 py-0.5 rounded text-[12px]">{c.corrected}</span>
                      </div>
                      {c.tip && (
                        <p className="mt-1.5 text-xs text-slate-400">💡 {c.tip}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Footer */}
      <footer className="text-center pb-8 pt-4 text-xs text-slate-600">
        AI English Coach · Powered by DeepSeek AI
      </footer>

      {/* 动画样式 */}
      <style>{`
        @keyframes barGrow {
          from { transform: scaleY(0); transform-origin: bottom; }
          to { transform: scaleY(1); transform-origin: bottom; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        @media print {
          body { background: white !important; color: black !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  )
}

/** 雷达图颜色 */
const RADAR_COLORS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa']

/** ===== v4: 综合得分环（借鉴 report 原型，CSS 动画）===== */
const ScoreRing = memo(function ScoreRing({ score, size = 100 }) {
  const r = (size - 12) / 2
  const circumference = 2 * Math.PI * r
  const safeScore = score == null ? 0 : Math.max(0, Math.min(100, score))
  const offset = circumference - (safeScore / 100) * circumference
  const color = safeScore >= 80 ? '#22c55e' : safeScore >= 60 ? '#FFC107' : '#FF6B6B'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white" style={{ lineHeight: 1 }}>
          {score != null ? Math.round(score) : '—'}
        </span>
        <span className="text-[10px] text-white/70 mt-0.5">分</span>
      </div>
    </div>
  )
})

function RadarChart({ data, size = 200 }) {
  const cx = size / 2
  const cy = size / 2
  const maxRadius = size * 0.38
  const levels = 5 // 同心五边形层数
  const angleStep = (Math.PI * 2) / data.length

  // 计算每个数据点的坐标
  function getPoint(index, value) {
    const angle = angleStep * index - Math.PI / 2
    const r = (value / 100) * maxRadius
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  // 生成多边形顶点字符串
  function polygonPoints(value) {
    return data.map((_, i) => {
      const p = getPoint(i, value)
      return `${p.x},${p.y}`
    }).join(' ')
  }

  // 背景网格线
  const gridLines = Array.from({ length: levels }, (_, i) => ({
    points: polygonPoints(((i + 1) / levels) * 100),
    opacity: 0.08 + i * 0.03,
  }))

  // 数据区域
  const dataPoints = data.map((d, i) => getPoint(i, d.value))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 同心网格 */}
      {gridLines.map((line, i) => (
        <polygon key={i}
          points={line.points}
          fill="none"
          stroke="#475569"
          strokeWidth={0.5}
          strokeOpacity={line.opacity}
        />
      ))}

      {/* 从中心到各顶点的轴线 */}
      {data.map((_, i) => {
        const end = getPoint(i, 100)
        return (
          <line key={i}
            x1={cx} y1={cy} x2={end.x} y2={end.y}
            stroke="#334155" strokeWidth={0.5}
            strokeOpacity={0.3}
          />
        )
      })}

      {/* 数据区域填充 */}
      <polygon
        points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
        fill="url(#radarGradient)"
        fillOpacity="0.25"
        stroke="url(#radarStroke)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={RADAR_COLORS[i]} stroke="#020617" strokeWidth={1} />
      ))}

      {/* 标签文字 */}
      {data.map((d, i) => {
        const labelPos = getPoint(i, 125) // 放在更外面
        return (
          <text key={i}
            x={labelPos.x} y={labelPos.y}
            textAnchor="middle" dominantBaseline="central"
            fontSize={10} fontWeight="500" fill={RADAR_COLORS[i]}
          >
            {d.label}
          </text>
        )
      })}

      {/* 渐变定义 */}
      <defs>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#34d399" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** 统计卡片 */
function StatCard({ icon, label, value, color, border, highlight }) {
  return (
    <div className={`bg-gradient-to-br ${color} ${border} border rounded-xl p-4 text-center`}>
      <div className="text-2xl mb-1.5">{icon}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

/** 空状态 */
function EmptyState({ navigate }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <p className="text-slate-400 mb-4">暂无练习记录</p>
        <button onClick={() => navigate('/')} className="text-indigo-400 font-medium hover:text-indigo-300">
          返回首页开始练习 →
        </button>
      </div>
    </div>
  )
}