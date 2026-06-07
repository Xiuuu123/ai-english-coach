import { memo } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 会员开通弹窗
 *
 * 教育类蓝色风格：
 * - 渐变蓝色背景（#4F8BFF → #2A6BFF）
 * - 金色皇冠图标
 * - 三大权益清单
 * - 价格 + 立即开通按钮
 * - ESC 关闭 / 背景点击关闭
 */
const MembershipModal = memo(function MembershipModal({
  open,
  onClose,
  onActivate,
  reason = 'limit',
  sceneName = '',
  remaining = 0,
}) {
  const navigate = useNavigate()

  if (!open) return null

  const handleActivate = () => {
    if (onActivate) onActivate()
    if (onClose) onClose()
    // 跳转到会员页面
    setTimeout(() => navigate('/vip'), 200)
  }

  const reasonText = {
    limit: '今日免费次数已用完，开通会员解锁无限练习',
    feature: '该功能仅对会员开放',
  }[reason] || '今日免费次数已用完，开通会员解锁无限练习'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="membership-modal-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{
          background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
          border: '1px solid rgba(79, 139, 255, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部装饰渐变 */}
        <div
          className="absolute top-0 left-0 right-0 h-32 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at top, #4F8BFF 0%, transparent 70%)',
          }}
        />

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          aria-label="关闭弹窗"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative p-6">
          {/* 皇冠图标 */}
          <div className="flex justify-center mb-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                boxShadow: '0 8px 24px rgba(255, 165, 0, 0.35)',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 17h18M5 17l-1.5-9L7 11l5-7 5 7 3.5-3L19 17M5 17h14"
                  stroke="#FFF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="rgba(255,255,255,0.15)"
                />
              </svg>
            </div>
          </div>

          {/* 标题 */}
          <h2
            id="membership-modal-title"
            className="text-xl font-bold text-center text-white mb-1"
          >
            开通 VIP 会员
          </h2>
          <p className="text-sm text-center text-slate-400 mb-5">
            {reasonText}
          </p>

          {/* 剩余次数提示（仅 limit 原因时显示） */}
          {reason === 'limit' && sceneName && (
            <div
              className="mb-4 px-3 py-2 rounded-lg text-center text-xs"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#FCA5A5',
              }}
            >
              「{sceneName}」免费次数已用完（0/7）
            </div>
          )}

          {/* 权益清单 */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{
              background: 'rgba(79, 139, 255, 0.06)',
              border: '1px solid rgba(79, 139, 255, 0.15)',
            }}
          >
            <p className="text-xs text-slate-400 mb-3 font-medium">解锁权益</p>
            <ul className="space-y-2.5">
              {[
                { icon: '∞', label: '无限对话次数' },
                { icon: '🌍', label: '解锁全部场景' },
                { icon: '📊', label: '完整发音评测报告' },
                { icon: '🎯', label: '音素级错误分析' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
                    style={{
                      background: 'rgba(79, 139, 255, 0.15)',
                      color: '#4F8BFF',
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-sm text-slate-200">{item.label}</span>
                  <span className="ml-auto text-blue-400">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7l3 3 5-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 价格 */}
          <div className="text-center mb-4">
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-sm text-slate-500 line-through">¥39.9</span>
              <span
                className="text-3xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #4F8BFF 0%, #2A6BFF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ¥19.9
              </span>
              <span className="text-xs text-slate-400">/ 终身</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">限时优惠 · 一次开通永久使用</p>
          </div>

          {/* 开通按钮 */}
          <button
            onClick={handleActivate}
            className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #4F8BFF 0%, #2A6BFF 100%)',
              boxShadow: '0 8px 24px rgba(42, 107, 255, 0.4)',
            }}
          >
            立即开通
          </button>

          {/* 底部说明 */}
          <p className="text-center text-[10px] text-slate-500 mt-3">
            本应用为演示项目，开通即视为模拟支付成功
          </p>
        </div>
      </div>
    </div>
  )
})

export default MembershipModal
