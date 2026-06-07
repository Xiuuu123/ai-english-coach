import { useNavigate } from 'react-router-dom'
import { useMembership } from '../hooks/useMembership'

/**
 * VIP 会员购买页面
 *
 * - 展示会员价格、权益
 * - 立即开通按钮 → 模拟支付成功
 * - 已开通状态显示"已开通"徽章
 */
export default function VipPage() {
  const navigate = useNavigate()
  const { vip, activateVip, deactivateVip, freeLimit } = useMembership()

  function handlePurchase() {
    if (vip) return
    activateVip()
    // 模拟支付延迟
    setTimeout(() => {
      navigate(-1)
    }, 800)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #020617 100%)',
      }}
    >
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="text-indigo-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1"
          >
            ← 返回
          </button>
          <h1 className="flex-1 text-center font-semibold text-white text-base pr-12">会员中心</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 皇冠 + 标题区 */}
          <div className="text-center mb-6">
            <div
              className="inline-flex w-20 h-20 rounded-3xl items-center justify-center mb-4 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                boxShadow: '0 12px 32px rgba(255, 165, 0, 0.4)',
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
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
            <h2 className="text-2xl font-bold text-white mb-1">AI 英语口语陪练</h2>
            <p className="text-sm text-slate-400">开通 VIP · 解锁全部功能</p>

            {vip && (
              <div
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.15) 100%)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  color: '#FFD700',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                VIP 会员已开通
              </div>
            )}
          </div>

          {/* 会员卡片 */}
          <div
            className="rounded-2xl p-6 mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(79, 139, 255, 0.08) 0%, rgba(42, 107, 255, 0.05) 100%)',
              border: '1px solid rgba(79, 139, 255, 0.2)',
            }}
          >
            {/* 价格 */}
            <div className="text-center mb-5">
              <p className="text-xs text-slate-400 mb-1">终身会员 · 一次开通永久使用</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-sm text-slate-500 line-through">¥39.9</span>
                <span
                  className="text-5xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #4F8BFF 0%, #2A6BFF 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  ¥19.9
                </span>
              </div>
              <div
                className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: 'rgba(255, 68, 68, 0.15)', color: '#FCA5A5' }}
              >
                限时优惠 · 立省 20 元
              </div>
            </div>

            {/* 权益清单 */}
            <div className="space-y-3 mb-5">
              {[
                { icon: '∞', title: '无限对话次数', desc: `告别每场景 ${freeLimit} 次限制，想练多久练多久` },
                { icon: '🌍', title: '全部场景解锁', desc: '面试 / 点餐 / 会议 / 学术等所有场景' },
                { icon: '📊', title: '完整发音报告', desc: '音素级错误分析、连读 / 重音 / 语调检测' },
                { icon: '🎯', title: '精准纠错', desc: '音标对比、错误单词高亮、智能改进建议' },
                { icon: '⚡', title: '优先响应', desc: '会员专属 API 通道，对话更流畅' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{
                      background: 'rgba(79, 139, 255, 0.15)',
                    }}
                  >
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-blue-400 mt-1.5 shrink-0">
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
                </div>
              ))}
            </div>

            {/* 开通按钮 */}
            <button
              onClick={handlePurchase}
              disabled={vip}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: vip
                  ? 'linear-gradient(135deg, #475569 0%, #334155 100%)'
                  : 'linear-gradient(135deg, #4F8BFF 0%, #2A6BFF 100%)',
                boxShadow: vip ? 'none' : '0 8px 24px rgba(42, 107, 255, 0.4)',
              }}
            >
              {vip ? '✓ 已是会员' : '立即开通 · ¥19.9'}
            </button>

            {vip && (
              <button
                onClick={deactivateVip}
                className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                （测试）取消会员
              </button>
            )}

            {/* 底部说明 */}
            <p className="text-center text-[10px] text-slate-500 mt-3">
              本应用为演示项目 · 点击开通即视为模拟支付成功
            </p>
          </div>

          {/* 常见问题 */}
          <div
            className="rounded-xl p-4 text-xs text-slate-400 space-y-2"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <p className="text-slate-300 font-medium mb-2">常见问题</p>
            <p>
              <span className="text-slate-500">Q：免费次数会重置吗？</span>
              <br />
              A：不会。每个场景只有 7 次免费对话，用完即止。
            </p>
            <p>
              <span className="text-slate-500">Q：会员是月付还是终身？</span>
              <br />
              A：一次开通，永久使用。
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
