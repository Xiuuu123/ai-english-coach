import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { playReceiveSound } from '../utils/soundEffects'

export default function BadgeModal({ scene, onClose }) {
  const navigate = useNavigate()
  const hasPlayedRef = useRef(false)

  useEffect(() => {
    if (!hasPlayedRef.current) {
      playReceiveSound()
      hasPlayedRef.current = true
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* 勋章弹窗 */}
      <div
        className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部渐变装饰 */}
        <div className="h-32 bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 flex items-center justify-center relative">
          {/* 旋转光晕 */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-4 border-white/30 animate-spin"
              style={{ animationDuration: '8s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-white/20 animate-spin"
              style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
          </div>

          {/* 勋章 */}
          <div className="relative z-10 text-center">
            <div className="text-6xl animate-bounce-in">
              {scene.badge || '🏅'}
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-1">
            恭喜通关！
          </h2>
          <p className="text-amber-400 font-bold text-lg mb-2">
            {scene.badgeName}
          </p>
          <p className="text-slate-400 text-sm mb-1">
            {scene.badgeNameEn}
          </p>
          <p className="text-slate-500 text-xs mt-3 leading-relaxed">
            你已完成 <span className="text-white font-semibold">{scene.name}</span> 全部关卡，
            <br />
            获得专属电子勋章！
          </p>

          {/* 勋章墙预览 */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-3 border border-white/5">
            <div className="text-3xl mb-1">{scene.badge}</div>
            <p className="text-xs text-slate-500">已收藏到勋章墙</p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 pb-5 space-y-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all active:scale-[0.98]"
          >
            继续挑战
          </button>
          <button
            onClick={() => {
              onClose()
              navigate('/')
            }}
            className="w-full py-2.5 bg-slate-800 text-slate-400 font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-all"
          >
            返回场景选择
          </button>
        </div>
      </div>
    </div>
  )
}