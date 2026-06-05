import { useNavigate } from 'react-router-dom'
import { scenes } from '../data/scenes'

export default function SceneSelectPage() {
  const navigate = useNavigate()

  function handleSelect(sceneId) {
    navigate(`/chat/${sceneId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative pt-12 pb-6 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="text-4xl animate-bounce" style={{ animationDuration: '2s' }}>🎙️</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent tracking-tight">
          AI English Coach
        </h1>
        <p className="mt-3 text-lg text-indigo-200/70 max-w-md mx-auto leading-relaxed">
          选择场景，开始你的英语口语练习
        </p>
      </header>

      {/* Scene Cards */}
      <main className="relative max-w-4xl mx-auto px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {scenes.map((scene, index) => (
            <button
              key={scene.id}
              onClick={() => handleSelect(scene.id)}
              className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm
                border border-white/10 p-8 text-left shadow-2xl
                hover:bg-white/10 hover:border-white/20 hover:shadow-indigo-500/20
                transition-all duration-500 hover:-translate-y-2 active:scale-[0.98]
                cursor-pointer"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* 卡片顶部渐变条 */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${scene.color} opacity-60 group-hover:opacity-100 transition-opacity`} />

              {/* 图标 */}
              <div className={`text-5xl mb-5 drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                {scene.icon}
              </div>

              {/* 标题 */}
              <h2 className="text-xl font-bold text-white mb-1">{scene.name}</h2>
              <p className="text-sm text-indigo-300/60 mb-4 font-medium">{scene.nameEn}</p>

              {/* 描述 */}
              <p className="text-sm text-indigo-200/50 leading-relaxed mb-6">
                {scene.description}
              </p>

              {/* 底部操作区 */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                <span className="text-xs font-medium text-indigo-400/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  可用
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                  开始练习
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>

              {/* 悬停光效 */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </button>
          ))}
        </div>

        {/* Tips 卡片 */}
        <div className="mt-10 p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
          <h3 className="font-bold text-white flex items-center gap-2 mb-4">
            <span className="text-lg">💡</span> 使用提示
          </h3>
          <ul className="grid md:grid-cols-3 gap-3 text-sm text-indigo-200/60">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">🎤</span>
              点击下方麦克风按钮按住说话，松开后自动发送
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">🔧</span>
              AI 会实时纠正你的语法错误并给出评分
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">📋</span>
              练习结束后可查看本次对话总结报告
            </li>
          </ul>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-indigo-300/30">
          Powered by DeepSeek AI · Web Speech API · Built with React
        </footer>
      </main>
    </div>
  )
}