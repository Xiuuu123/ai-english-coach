import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLevelProgress } from '../hooks/useLevelProgress'

export default function LevelSelect({ scene, onClose }) {
  const navigate = useNavigate()
  const { isLevelUnlocked, isLevelCompleted, getCompletedCount, hasBadge } = useLevelProgress()
  const totalLevels = scene.levels.length
  const completedCount = getCompletedCount(scene.id)
  const [showBadge, setShowBadge] = useState(false)
  const allDone = completedCount >= totalLevels

  function handleStartLevel(levelIndex) {
    if (!isLevelUnlocked(scene.id, levelIndex)) return
    navigate(`/chat/${scene.id}/${levelIndex}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 面板 */}
      <div
        className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md rounded-t-2xl px-5 py-4 border-b border-white/5 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{scene.icon}</span>
              <div>
                <h3 className="text-lg font-bold text-white">{scene.name}</h3>
                <p className="text-xs text-slate-400">{scene.nameEn}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 进度条 */}
          <div className="mt-3">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs text-slate-400">闯关进度</span>
              <span className="text-xs font-bold text-indigo-400">{completedCount}/{totalLevels}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalLevels) * 100}%` }}
              />
            </div>
          </div>

          {/* 全通关徽章 */}
          {allDone && hasBadge(scene.id) && (
            <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <span className="text-lg">{scene.badge}</span>
              <div>
                <p className="text-xs font-bold text-amber-400">已获得 {scene.badgeName}</p>
                <p className="text-[10px] text-amber-400/60">{scene.badgeNameEn}</p>
              </div>
            </div>
          )}
        </div>

        {/* 关卡列表 */}
        <div className="px-5 py-3 space-y-2.5">
          {scene.levels.map((level, i) => {
            const unlocked = isLevelUnlocked(scene.id, level.index)
            const completed = isLevelCompleted(scene.id, level.index)

            return (
              <button
                key={level.index}
                onClick={() => handleStartLevel(level.index)}
                disabled={!unlocked}
                className={`w-full text-left rounded-xl p-3.5 transition-all duration-200 flex items-center gap-3
                  ${completed
                    ? 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15'
                    : unlocked
                      ? 'bg-slate-800/60 border border-white/5 hover:border-indigo-500/30 hover:bg-slate-800'
                      : 'bg-slate-800/30 border border-white/5 opacity-50 cursor-not-allowed'
                  }`}
              >
                {/* 关卡序号/图标 */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0
                  ${completed
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : unlocked
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-slate-700/50 text-slate-500'
                  }`}>
                  {completed ? '✅' : unlocked ? level.icon : '🔒'}
                </div>

                {/* 关卡信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${completed ? 'text-emerald-400' : unlocked ? 'text-white' : 'text-slate-500'}`}>
                      {level.name}
                    </span>
                    {completed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                        已通关
                      </span>
                    )}
                    {!unlocked && !completed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500">
                        未解锁
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{level.description}</p>
                </div>

                {/* 箭头 */}
                {unlocked && (
                  <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* 底部提示 */}
        <div className="px-5 py-3 border-t border-white/5">
          <p className="text-xs text-slate-600 text-center">
            通关条件：平均得分 ≥ 65 分，完成 3 轮对话
          </p>
        </div>
      </div>
    </div>
  )
}