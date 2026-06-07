import { useMemo, useState } from 'react'
import { analyzePronunciation, getScoreGrade } from '../utils/pronunciation'

/**
 * 发音评测卡片组件 v2
 *
 * 增强展示：
 * 1. 综合评分圆环
 * 2. 逐词得分 + 音素混淆高亮（红/橙/黄）+ 标准音标
 * 3. 重音位置标注（多音节词）
 * 4. 连读分析（辅-元连读、元-元连读）
 * 5. 语调分析
 * 6. 中式英语纠正
 */

const SEVERITY_COLORS = {
  high: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5', border: 'rgba(239,68,68,0.3)', ring: '#ef4444' },
  medium: { bg: 'rgba(249,115,22,0.12)', text: '#fdba74', border: 'rgba(249,115,22,0.25)', ring: '#f97316' },
  low: { bg: 'rgba(234,179,8,0.1)', text: '#fde047', border: 'rgba(234,179,8,0.2)', ring: '#eab308' },
}

export default function PronunciationCard({ spokenText }) {
  const [expandedWord, setExpandedWord] = useState(null)

  const result = useMemo(() => analyzePronunciation(spokenText), [spokenText])

  if (!spokenText || !result.wordAnalysis.length) return null

  const grade = getScoreGrade(result.overallScore)

  return (
    <div className="mx-3 sm:mx-4 mb-2 bg-gradient-to-br from-slate-800/90 to-indigo-950/30 backdrop-blur-sm border border-cyan-500/15 rounded-2xl overflow-hidden animate-slide-up">
      {/* ====== 头部：综合评分 ====== */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="font-semibold text-white text-sm">发音评测</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#1e293b" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15" fill="none"
              stroke={grade.color} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${result.overallScore / 100 * 94.25} 94.25`}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
            <text x="18" y="18" dominantBaseline="central" textAnchor="middle"
              fontSize="11" fontWeight="bold" fill={grade.color}>
              {result.overallScore}
            </text>
          </svg>
          <div className="text-right">
            <div className="text-xs font-bold" style={{ color: grade.color }}>{grade.label}</div>
            <div className="text-[10px] text-slate-500">{grade.grade}级</div>
          </div>
        </div>
      </div>

      {/* ====== 逐词分析 + 音标 + 音素混淆 ====== */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[11px] text-slate-400 mb-2.5">逐词分析 · 音素准确度</p>
        <div className="flex flex-wrap gap-1.5">
          {result.wordAnalysis.map((w, i) => {
            const isExpanded = expandedWord === i
            const hasConfusion = w.phonemeConfusions.length > 0
            const sev = hasConfusion ? w.phonemeConfusions[0].severity : null
            const colors = sev ? SEVERITY_COLORS[sev] : null

            return (
              <div key={i} className="relative group">
                <button
                  onClick={() => setExpandedWord(isExpanded ? null : i)}
                  className={[
                    'inline-flex flex-col items-center px-2 py-1 rounded-lg text-xs font-medium transition-all',
                    hasConfusion
                      ? `border cursor-pointer hover:scale-105`
                      : w.score >= 85
                        ? 'bg-green-500/10 text-green-300'
                        : w.score >= 70
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : 'bg-red-500/10 text-red-300'
                  ].join(' ')}
                  style={hasConfusion ? {
                    backgroundColor: colors.bg,
                    color: colors.text,
                    borderColor: colors.border,
                  } : {}}
                  title={w.ipa ? `${w.word} ${w.ipa}` : w.word}
                >
                  <span className="flex items-center gap-0.5">
                    {w.word}
                    {hasConfusion && (
                      <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-70">
                        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="5" y1="2.5" x2="5" y2="6" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="5" cy="7.5" r="0.6" fill="currentColor" />
                      </svg>
                    )}
                  </span>
                  {/* 音标行 */}
                  {w.ipa && (
                    <span className="text-[9px] mt-0.5 opacity-50 font-mono">{w.ipa}</span>
                  )}
                </button>

                {/* 展开详情：音素混淆 + 重音 */}
                {isExpanded && hasConfusion && (
                  <div className="absolute bottom-full left-0 mb-1.5 z-10 w-64 bg-slate-800 border border-white/10 rounded-xl p-2.5 shadow-xl animate-slide-up">
                    <p className="text-[10px] text-slate-400 mb-1.5">音素混淆分析</p>
                    {w.phonemeConfusions.map((c, ci) => (
                      <div key={ci} className="mb-1.5 last:mb-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                            style={{ backgroundColor: SEVERITY_COLORS[c.severity].bg, color: SEVERITY_COLORS[c.severity].text }}>
                            {c.label}
                          </span>
                          <span className="text-[10px] text-slate-500 capitalize">{c.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">{c.desc}</p>
                      </div>
                    ))}
                    {w.stress && w.syllables && (
                      <div className="mt-1.5 pt-1.5 border-t border-white/5">
                        <span className="text-[10px] text-slate-400">重音：第</span>
                        <span className="text-[10px] text-cyan-400 font-bold">{w.stress}</span>
                        <span className="text-[10px] text-slate-400">音节 · 音节划分：</span>
                        <span className="text-[10px] text-slate-300 font-mono">{w.syllables.join('·')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 图例 */}
        {result.phonemeAnalysis.length > 0 && (
          <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-white/5">
            <span className="text-[10px] text-slate-500">图例：</span>
            {['high', 'medium', 'low'].map(sev => {
              const c = SEVERITY_COLORS[sev]
              const hasThis = result.phonemeAnalysis.some(p => p.severity === sev)
              if (!hasThis) return null
              return (
                <span key={sev} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.ring }} />
                  <span className="text-[10px]" style={{ color: c.text }}>
                    {sev === 'high' ? '高风险' : sev === 'medium' ? '中风险' : '低风险'}
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* ====== 连读分析 ====== */}
      {result.linkingAnalysis.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[11px] text-slate-400 mb-2">连读机会</p>
          <div className="flex flex-wrap gap-1.5">
            {result.linkingAnalysis.map((link, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs
                  bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
              >
                <span className="font-mono">{link.words[0]}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-indigo-400">
                  <path d="M2 6 L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 4 L10 6 L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
                <span className="font-mono">{link.words[1]}</span>
                <span className="text-[10px] opacity-60 ml-1">({link.rule.name})</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {result.linkingAnalysis[0].rule.desc} — 例：{result.linkingAnalysis[0].rule.example}
          </p>
        </div>
      )}

      {/* ====== 语调分析 ====== */}
      {result.intonationAnalysis && (
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-slate-400">语调模式</p>
            <span className={[
              'px-2 py-0.5 rounded-full text-[10px] font-medium',
              result.intonationAnalysis.pattern === 'rising' || result.intonationAnalysis.pattern === 'rise-fall'
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-cyan-500/15 text-cyan-300'
            ].join(' ')}>
              {result.intonationAnalysis.label}
            </span>
            <span className="text-[10px] text-slate-500">{result.intonationAnalysis.desc}</span>
          </div>
        </div>
      )}

      {/* ====== 提示和问题 ====== */}
      {(result.tips.length > 0 || result.issues.length > 0) && (
        <div className="px-4 py-3">
          <div className="flex gap-6">
            {/* 优点 */}
            <div className="flex-1">
              <p className="text-[11px] text-slate-400 mb-1.5">亮点</p>
              <div className="space-y-1">
                {result.strengths.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span>✓</span>{s}
                  </div>
                ))}
              </div>
            </div>
            {/* 问题 */}
            {result.issues.length > 0 && (
              <div className="flex-1">
                <p className="text-[11px] text-slate-400 mb-1.5">注意</p>
                <div className="space-y-1">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="text-xs text-orange-400/80">
                      <span className="line-through opacity-60 mr-1">{issue.original}</span>
                      → <span className="text-orange-300 font-medium">{issue.correct}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 音素提示 */}
          {result.tips.filter(t => t.includes('音素')).length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              {result.tips.filter(t => t.includes('音素') || t.includes('连读')).map((tip, i) => (
                <p key={i} className="text-[11px] text-cyan-400/70 flex items-start gap-1">
                  <span className="shrink-0">💬</span>{tip}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}