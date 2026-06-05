import { useLocation, useNavigate } from 'react-router-dom'
import { analyzePronunciation } from '../utils/pronunciation'

export default function SummaryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { messages = [], scene } = location.state || {}

  // 统计数据
  const userMessages = messages.filter(m => m.role === 'user')
  const aiMessages = messages.filter(m => m.role === 'assistant')
  const allCorrections = aiMessages.flatMap(m => m.corrections || [])
  const scores = aiMessages.filter(m => m.score != null).map(m => m.score)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  // 错误类型分布（带分类标签）
  const errorTypes = { '语法错误': 0, '用词不当': 0, '发音问题': 0, '表达不自然': 0, '其他': 0 }
  allCorrections.forEach(c => {
    const tip = (c.tip || '').toLowerCase()
    if (tip.includes('grammar') || tip.includes('语法') || tip.includes("'t") || tip.includes('verb')) errorTypes['语法错误']++
    else if (tip.includes('vocab') || tip.includes('词汇') || tip.includes('word') || tip.includes('instead of')) errorTypes['用词不当']++
    else if (tip.includes('pronun') || tip.includes('发音') || tip.includes('sound') || tip.includes('say')) errorTypes['发音问题']++
    else if (tip.includes('natural') || tip.includes('表达') || tip.includes('expression')) errorTypes['表达不自然']++
    else errorTypes['其他']++
  })
  // 移除空类别
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

  // 发音专项分析（对每条用户消息做发音评测）
  const pronunciationAnalyses = userMessages.map(m => analyzePronunciation(m.content)).filter(p => p.wordAnalysis.length > 0)
  const avgPronunciationScore = pronunciationAnalyses.length > 0
    ? Math.round(pronunciationAnalyses.reduce((s, p) => s + p.overallScore, 0) / pronunciationAnalyses.length)
    : null

  // 难词掌握情况
  const difficultWordsFound = pronunciationAnalyses.flatMap(p => p.difficultyWordsFound)
  const uniqueDifficultWords = [...new Map(difficultWordsFound.map(w => [w.word, w])).values()]

  // 能力雷达图数据
  const radarData = [
    { label: '流利度', value: avgScore ? Math.min(100, avgScore + 5) : 72 },
    { label: '语法', value: avgScore ? Math.max(40, avgScore - (errorTypes['语法错误'] * 3)) : 68 },
    { label: '词汇量', value: Math.min(95, 55 + totalWords / 3) },
    { label: '发音', value: avgPronunciationScore || (avgScore ? Math.max(50, avgScore - 8) : 65) },
    { label: '自信度', value: Math.min(95, 60 + userMessages.length * 3) },
  ]

  if (!messages.length) return <EmptyState navigate={navigate} />

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-10 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-white/70">练习报告</span>
            <span className="text-xs text-white/40">|</span>
            <span className="text-sm text-white/70">{new Date().toLocaleDateString('zh-CN')}</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className={`w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl`}>
              {scene?.icon}
            </span>
            {scene?.name} 场景总结
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard icon="💬" label="对话轮数" value={userMessages.length} color="from-blue-500/20 to-blue-600/20" border="border-blue-500/20" />
          <StatCard icon="⭐" label="平均得分" value={avgScore ?? '--'} color="from-yellow-500/20 to-orange-500/20" border="border-yellow-500/20" highlight={avgScore >= 80} />
          <StatCard icon="🔧" label="纠正次数" value={allCorrections.length} color="from-orange-500/20 to-red-500/20" border="border-orange-500/20" />
          <StatCard icon="📝" label="总词数" value={totalWords} color="from-emerald-500/20 to-teal-500/20" border="border-emerald-500/20" />
        </div>

        {/* 得分趋势图 */}
        {scores.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white flex items-center gap-2">
                📈 得分趋势
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {minScore !== maxScore && (
                  <span className={scoreImprovement >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {scoreImprovement >= 0 ? '↑' : '↓'} {Math.abs(scoreImprovement)}分
                  </span>
                )}
                <span>最高 {maxScore} · 最低 {minScore}</span>
              </div>
            </div>
            {/* CSS 柱状图 */}
            <div className="flex items-end gap-2 h-36 px-2">
              {scoreTrend.map((item, i) => {
                const heightPercent = Math.max(item.score, 5)
                const isLast = i === scoreTrend.length - 1
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
            <RadarChart data={radarData} size={220} />
          </div>
          {/* 维度说明 */}
          <div className="grid grid-cols-5 gap-1 mt-4">
            {radarData.map((d, i) => (
              <div key={i} className="text-center">
                <div className="text-[11px] font-bold" style={{ color: RADAR_COLORS[i] }}>{d.value}</div>
                <div className="text-[10px] text-slate-500">{d.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 发音专项分析 */}
        {pronunciationAnalyses.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white flex items-center gap-2">🗣️ 发音专项</h2>
              {avgPronunciationScore != null && (
                <span className={`text-sm font-bold ${avgPronunciationScore >= 80 ? 'text-green-400' : avgPronunciationScore >= 60 ? 'text-yellow-400' : 'text-orange-400'}`}>
                  平均 {avgPronunciationScore}分
                </span>
              )}
            </div>

            {/* 难词掌握 */}
            {uniqueDifficultWords.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">高级词汇使用 ({uniqueDifficultWords.length}个)</p>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueDifficultWords.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs border border-cyan-500/15">
                      {w.word}
                      <span className="text-[9px] opacity-50">{w.ipa}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 发音趋势 */}
            {pronunciationAnalyses.length > 1 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">发音得分趋势</p>
                <div className="flex items-end gap-1 h-16">
                  {pronunciationAnalyses.map((p, i) => {
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

        {/* 错误类型分布 */}
        {Object.keys(errorTypes).length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h2 className="font-bold text-white mb-5 flex items-center gap-2">
              🔍 错误分析
            </h2>
            <div className="space-y-3">
              {Object.entries(errorTypes).map(([type, count]) => {
                const percent = (count / maxErrorCount) * 100
                const barColor = type === '语法错误' ? 'from-red-500 to-red-400'
                  : type === '用词不当' ? 'from-yellow-500 to-yellow-400'
                  : type === '表达不自然' ? 'from-blue-500 to-blue-400'
                  : 'from-slate-500 to-slate-400'
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-300">{type}</span>
                      <span className="text-slate-400 font-medium">{count}次 ({Math.round(count / allCorrections.length * 100)}%)</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000`}
                        style={{ width: `${percent}%`, minWidth: count > 0 ? '24px' : '0' }}
                      >
                        <span className="pl-2 text-[10px] text-white/70 leading-8">{count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 纠错详情 */}
        {allCorrections.length > 0 && (
          <section className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <h2 className="font-bold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">📝 纠错汇总</span>
              <span className="text-xs font-normal text-slate-400">{uniqueErrors}个不同错误 · {allCorrections.length}次纠正</span>
            </h2>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {[...new Map(allCorrections.map(c => [c.original, c])).values()].map((c, i) => (
                <div key={i} className="bg-slate-800/60 rounded-xl p-3.5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-red-400 line-through bg-red-500/10 px-2 py-0.5 rounded">{c.original}</span>
                    <span className="text-green-400 font-medium shrink-0">→</span>
                    <span className="text-green-300 font-medium bg-green-500/10 px-2 py-0.5 rounded">{c.corrected}</span>
                  </div>
                  {c.tip && (
                    <p className="mt-1.5 text-xs text-slate-400 pl-0.5 flex items-start gap-1">
                      <span>💡</span>{c.tip}
                    </p>
                  )}
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

/**
 * 纯 CSS/SVG 实现的雷达图（五边形）
 * 无需任何图表库
 */
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