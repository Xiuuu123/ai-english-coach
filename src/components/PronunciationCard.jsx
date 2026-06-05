import { useMemo } from 'react'
import { analyzePronunciation, getScoreGrade } from '../utils/pronunciation'

/**
 * 发音评测卡片组件
 * 在用户发送消息后显示，展示逐词发音分析和综合评分
 */
export default function PronunciationCard({ spokenText }) {
  const result = useMemo(() => analyzePronunciation(spokenText), [spokenText])

  if (!spokenText || !result.wordAnalysis.length) return null

  const grade = getScoreGrade(result.overallScore)

  return (
    <div className="mx-3 sm:mx-4 mb-2 bg-gradient-to-br from-slate-800/90 to-indigo-950/30 backdrop-blur-sm border border-cyan-500/15 rounded-2xl overflow-hidden animate-slide-up">
      {/* 头部：评分概览 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="font-semibold text-white text-sm">发音评测</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 分数圆环 */}
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

      {/* 逐词分析 */}
      {result.wordAnalysis.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[11px] text-slate-400 mb-2">逐词分析</p>
          <div className="flex flex-wrap gap-1.5">
            {result.wordAnalysis.map((w, i) => {
              const wordGrade = getScoreGrade(w.score)
              return (
                <span key={i}
                  className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium transition-colors
                    ${w.isDifficult
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      : w.score >= 85
                        ? 'bg-green-500/10 text-green-300'
                        : w.score >= 70
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : 'bg-red-500/10 text-red-300'
                    }`}
                  title={w.tip || `${w.word}: ${w.score}分`}>
                  {w.word}
                  {w.isDifficult && (
                    <span className="ml-1 text-[10px] opacity-60">★</span>
                  )}
                </span>
              )
            })}
          </div>

          {/* 难词提示 */}
          {result.tips.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.tips.slice(0, 2).map((tip, i) => (
                <p key={i} className="text-[11px] text-cyan-400/70 flex items-start gap-1">
                  <span className="shrink-0">💬</span>{tip}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 能力维度 + 优点 */}
      <div className="px-4 py-3 flex gap-6">
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
    </div>
  )
}