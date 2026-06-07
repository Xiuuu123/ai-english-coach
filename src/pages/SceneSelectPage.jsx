import { useState, useMemo, useDeferredValue, useTransition } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { scenes } from '../data/scenes'
import { useLevelProgress } from '../hooks/useLevelProgress'

/* ====== 分类元数据 ====== */
const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'career', name: '职场' },
  { id: 'life', name: '生活' },
  { id: 'academic', name: '学术' },
]

/* ====== 难度标签样式 ====== */
const DIFFICULTY_META = {
  beginner:  { label: '入门', bg: 'rgba(46,125,50,0.15)', color: '#4CAF50' },
  advanced:  { label: '进阶', bg: 'rgba(230,81,0,0.15)', color: '#FF9800' },
  expert:    { label: '高阶', bg: 'rgba(198,40,40,0.15)', color: '#EF5350' },
}

export default function SceneSelectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const deferredSearch = useDeferredValue(search)
  const [, startTransition] = useTransition()
  const { getSceneProgress, getCompletedCount, hasBadge } = useLevelProgress()

  const filteredScenes = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()
    return scenes.filter(s => {
      const matchCategory = activeCategory === 'all' || s.category === activeCategory
      const matchSearch = !keyword
        || s.name.toLowerCase().includes(keyword)
        || (s.nameEn || '').toLowerCase().includes(keyword)
        || s.description.toLowerCase().includes(keyword)
      return matchCategory && matchSearch
    })
  }, [deferredSearch, activeCategory])

  function handleSelect(sceneId) {
    // 跳转到第一个未通关的关卡
    const sp = getSceneProgress(sceneId)
    const nextLevel = sp.highestUnlocked ?? 0
    navigate(`/chat/${sceneId}/${nextLevel}`)
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ====== 顶部导航（Web 风格） ====== */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AI 英语口语陪练
            </h1>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" label="首页" active={isActive('/')} onClick={() => navigate('/')} />
            <NavLink to="/vip" label="VIP" active={isActive('/vip')} onClick={() => navigate('/vip')} />
            <NavLink to="/summary" label="报告" active={isActive('/summary')} onClick={() => navigate('/summary')} />
          </nav>
        </div>
      </header>

      {/* ====== 主体 ====== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* CTA 卡片 */}
        <section className="mb-8">
          <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.2) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl font-bold">今日口语练习</h2>
              <p className="text-slate-400 text-sm mt-1.5">每天开口 5 分钟，口语大不同</p>
              <div className="mt-5 max-w-xs">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs text-slate-500">今日目标进度</span>
                  <span className="text-xs font-bold text-indigo-400">{Math.min(100, filteredScenes.length * 33)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, filteredScenes.length * 33)}%` }} />
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10 text-8xl pointer-events-none select-none">🤖</div>
          </div>
        </section>

        {/* 搜索框 */}
        <section className="mb-5">
          <div className="relative max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索场景、话题..."
              className="w-full bg-slate-800/80 border border-white/10 rounded-xl h-11 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent transition-all"
              aria-label="搜索场景"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm"
                aria-label="清空搜索">✕</button>
            )}
          </div>
        </section>

        {/* 分类标签 */}
        <section className="mb-6 flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => startTransition(() => setActiveCategory(cat.id))}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border border-white/5 hover:border-white/15 hover:text-slate-200'
                ].join(' ')}
              >
                {cat.name}
              </button>
            )
          })}
        </section>

        {/* 场景卡片网格（Web 端 3 列） */}
        <section>
          {filteredScenes.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm">没有匹配的场景</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScenes.map(scene => {
                const diff = DIFFICULTY_META[scene.difficulty] || DIFFICULTY_META.beginner
                const totalLevels = scene.levels?.length || 1
                const completedCount = getCompletedCount(scene.id)
                const allDone = completedCount >= totalLevels && totalLevels > 0
                const sceneBadge = hasBadge(scene.id)
                return (
                  <button
                    key={scene.id}
                    onClick={() => handleSelect(scene.id)}
                    className="group rounded-2xl p-5 flex flex-col text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    aria-label={`开始${scene.name}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{scene.icon}</span>
                      <div className="flex items-center gap-1.5">
                        {/* v7: 勋章徽章 */}
                        {sceneBadge && (
                          <span className="text-sm" title={scene.badgeName}>{scene.badge}</span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: diff.bg, color: diff.color }}>{diff.label}</span>
                      </div>
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">{scene.name}</h4>
                    <p className="text-xs text-slate-500 mb-1">{scene.nameEn}</p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">{scene.description}</p>

                    {/* v7: 关卡进度条 */}
                    {totalLevels > 1 && (
                      <div className="mb-3">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[10px] text-slate-500">闯关进度</span>
                          <span className="text-[10px] font-bold text-indigo-400">{completedCount}/{totalLevels}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                            style={{ width: `${(completedCount / totalLevels) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-auto">
                      <span className={`inline-block w-full text-center text-xs font-semibold py-2 rounded-lg transition-all
                        ${allDone
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white group-hover:from-indigo-500 group-hover:to-purple-500'
                        }`}>
                        {allDone ? '🎉 已通关 · 再练一次' : '开始练习'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* 每日金句 */}
        <section className="mt-10">
          <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-indigo-400 text-lg">❝</span>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Daily Quote</span>
            </div>
            <p className="text-slate-200 text-base font-medium italic">
              "The beautiful thing about learning is that no one can take it away from you."
            </p>
            <p className="text-slate-500 text-sm mt-2">学习最美妙的地方在于，没有人能把它从你身边夺走。</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center pb-8 pt-4 text-xs text-slate-600">
        AI English Coach · Powered by DeepSeek AI
      </footer>
    </div>
  )
}

/* ====== 顶部导航链接 ====== */
function NavLink({ to, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-600/20 text-indigo-400'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
