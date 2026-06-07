import { useEffect, useState } from 'react'
import { useDailyGoal, formatDuration } from '../hooks/useDailyGoal'

/**
 * 每日口语练习目标卡片
 *
 * 视觉布局（深色科技风）：
 * ┌────────────────────────────────────────┐
 * │  🎯 今日口语练习          🔥 连续 3 天  │
 * │  每天开口 5 分钟，口语大不同              │
 * │                                        │
 * │  今日目标：5 分钟                       │
 * │  已练习：3 分钟 / 5 分钟                │
 * │                                        │
 * │  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  60%            │
 * │                                        │
 * │  [开始今日练习]                          │
 * └────────────────────────────────────────┘
 *
 * 完成态：
 * ┌────────────────────────────────────────┐
 * │  ✨ 今日目标已完成        🔥 连续 3 天  │
 * │  每天开口 5 分钟，口语大不同              │
 * │                                        │
 * │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%           │
 * │  今日已练习 5 分 12 秒                  │
 * └────────────────────────────────────────┘
 *
 * Props:
 *  - onStart: () => void   顶部 CTA 点击
 *  - goalSeconds?: number  目标秒数（默认 300 = 5 分钟）
 *  - compact?: boolean     紧凑模式（只显示进度条）
 */
export default function DailyGoalCard({ onStart, goalSeconds = 300, compact = false }) {
  const { totalSeconds, progress, progressPercent, isCompleted, streak, setGoal } =
    useDailyGoal(goalSeconds)
  const [showCelebration, setShowCelebration] = useState(false)

  // 监听"达成"事件 → 触发庆祝动画
  useEffect(() => {
    const handler = () => {
      setShowCelebration(true)
      const t = setTimeout(() => setShowCelebration(false), 3500)
      return () => clearTimeout(t)
    }
    window.addEventListener('daily-goal-achieved', handler)
    return () => window.removeEventListener('daily-goal-achieved', handler)
  }, [])

  // 颜色梯度：红→琥珀→青→绿
  const getColor = () => {
    if (progressPercent >= 100) return { from: 'from-emerald-500', to: 'to-teal-500', glow: 'rgba(16,185,129,0.4)' }
    if (progressPercent >= 60) return { from: 'from-cyan-500', to: 'to-blue-500', glow: 'rgba(6,182,212,0.35)' }
    if (progressPercent >= 30) return { from: 'from-amber-500', to: 'to-orange-500', glow: 'rgba(245,158,11,0.3)' }
    return { from: 'from-rose-500', to: 'to-pink-500', glow: 'rgba(244,63,94,0.3)' }
  }
  const color = getColor()

  // 紧凑模式
  if (compact) {
    return (
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2.5 backdrop-blur-sm"
        style={{ boxShadow: '0 0 12px rgba(99,102,241,0.08)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{isCompleted ? '✨' : '🎯'}</span>
            <span className="text-xs font-medium text-slate-200">今日口语</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {formatDuration(totalSeconds)} / {formatDuration(goalSeconds)}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-700/50">
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color.from} ${color.to} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(progress * 100, 100)}%`, boxShadow: `0 0 8px ${color.glow}` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 backdrop-blur-md p-4 sm:p-5 overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 24px rgba(99,102,241,0.1)' }}>

      {/* 背景光效（达成时高亮） */}
      <div
        className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${color.from} ${color.to} opacity-10 blur-3xl transition-opacity duration-700 ${isCompleted ? 'opacity-25' : ''}`}
      />

      {/* 庆祝粒子（仅完成时） */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-lg"
              style={{
                left: `${10 + (i * 7) % 80}%`,
                top: `${20 + (i * 11) % 60}%`,
                animation: `celebrateFloat 1.8s ease-out ${i * 0.1}s forwards`,
                opacity: 0,
              }}
            >
              {['🎉', '✨', '⭐', '🌟', '💫'][i % 5]}
            </span>
          ))}
        </div>
      )}

      {/* 顶部：标题 + 连续天数 */}
      <div className="relative flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${color.from} ${color.to} shadow-md`}
            style={{ boxShadow: `0 0 12px ${color.glow}` }}>
            <span className="text-base">{isCompleted ? '✨' : '🎯'}</span>
          </div>
          <div>
            <h3 className={`text-sm sm:text-base font-bold ${isCompleted ? 'text-emerald-300' : 'text-slate-100'}`}>
              {isCompleted ? '今日目标已完成' : '今日口语练习'}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500">
              每天开口 5 分钟，口语大不同
            </p>
          </div>
        </div>

        {/* 连续天数徽章 */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-400/30">
          <span className="text-sm">🔥</span>
          <span className="text-[11px] font-bold text-orange-300 tabular-nums">
            {streak} <span className="text-[10px] opacity-70">天</span>
          </span>
        </div>
      </div>

      {/* 中部：进度信息 */}
      <div className="relative mt-3 mb-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] sm:text-xs text-slate-400">
            今日目标：<span className="text-slate-200 font-medium">{formatDuration(goalSeconds)}</span>
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
            {progressPercent}%
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] sm:text-xs text-slate-400">
            已练习：<span className={`font-semibold tabular-nums ${isCompleted ? 'text-emerald-300' : 'text-cyan-300'}`}>
              {formatDuration(totalSeconds)}
            </span>
            <span className="text-slate-500"> / {formatDuration(goalSeconds)}</span>
          </span>
        </div>

        {/* 进度条（带渐变 + 发光 + 流光效果） */}
        <div className="relative h-2.5 sm:h-3 rounded-full overflow-hidden bg-slate-700/60 border border-slate-600/40">
          {/* 进度填充 */}
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color.from} ${color.to} transition-all duration-700 ease-out rounded-full`}
            style={{
              width: `${Math.min(progress * 100, 100)}%`,
              boxShadow: `0 0 10px ${color.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
            }}
          >
            {/* 流光效果：白色光带横扫 */}
            {!isCompleted && progress > 0.05 && (
              <div
                className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{ animation: 'shimmer 2.5s ease-in-out infinite' }}
              />
            )}
          </div>

          {/* 100% 时的小星星图标 */}
          {isCompleted && (
            <div className="absolute inset-0 flex items-center justify-end pr-1.5">
              <span className="text-[10px] animate-pulse">✓</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部：CTA 按钮 */}
      <div className="relative mt-3 flex items-center justify-between">
        <span className="text-[10px] sm:text-[11px] text-slate-500">
          {isCompleted
            ? '🎉 今日打卡完成，明天继续'
            : `还差 ${formatDuration(Math.max(goalSeconds - totalSeconds, 0))} 即可达成`}
        </span>
        {onStart && !isCompleted && (
          <button
            onClick={onStart}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r ${color.from} ${color.to} hover:brightness-110 active:scale-95 transition-all shadow-md`}
            style={{ boxShadow: `0 0 12px ${color.glow}` }}
          >
            <span>开始今日练习</span>
            <span>→</span>
          </button>
        )}
        {isCompleted && onStart && (
          <button
            onClick={onStart}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 transition-all"
          >
            <span>继续加练</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* 内联 CSS 动画 */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes celebrateFloat {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-80px) scale(1.2) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
