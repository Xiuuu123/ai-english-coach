import { useState, useEffect } from 'react'

/**
 * 实时纠错面板 v1
 *
 * 功能模块：
 * 1. 原文 / 优化句对比区
 * 2. 综合修改说明（自然段）
 * 3. 分项纠错（可折叠）：
 *    - 语法剖析 (grammar)
 *    - 词汇升级 (vocabulary / expression)
 *    - 发音技巧 (pronunciation)
 * 4. 优化句可点击播放标准发音
 * 5. 深色背景 + 卡片 + 分割线层级
 *
 * 布局：
 * - 桌面端 (≥ lg)：固定在右侧 sidebar
 * - 平板 (md ~ lg)：可折叠
 * - 手机 (< md)：底部抽屉
 *
 * 数据契约（来自 chatService 解析的 corrections 数组）：
 * corrections: [{
 *   original,         // 错误原文
 *   correction,       // 修改后
 *   type,             // 'grammar' | 'vocabulary' | 'expression' | 'pronunciation' | 'other'
 *   explanation,      // 详细说明
 *   suggestion,       // 简短建议（可选）
 *   severity,         // 'high' | 'medium' | 'low'（可选）
 * }]
 *
 * props:
 * - originalText:  用户原句
 * - optimizedText: 优化后整句
 * - explanation:   综合修改说明
 * - corrections:   分项纠错数组
 * - onPlay:        (text) => void  — 播放函数
 * - onClose?:      () => void       — 关闭（移动端抽屉用）
 * - variant:       'sidebar' | 'drawer' | 'modal'
 */

const TYPE_META = {
  grammar: {
    label: '语法剖析',
    icon: '📐',
    color: 'red',
    headerBg: 'bg-red-500/10',
    headerBorder: 'border-red-500/20',
    headerText: 'text-red-200',
    accent: 'border-l-red-400',
  },
  vocabulary: {
    label: '词汇升级',
    icon: '📚',
    color: 'blue',
    headerBg: 'bg-blue-500/10',
    headerBorder: 'border-blue-500/20',
    headerText: 'text-blue-200',
    accent: 'border-l-blue-400',
  },
  expression: {
    label: '表达优化',
    icon: '💡',
    color: 'yellow',
    headerBg: 'bg-yellow-500/10',
    headerBorder: 'border-yellow-500/20',
    headerText: 'text-yellow-200',
    accent: 'border-l-yellow-400',
  },
  pronunciation: {
    label: '发音技巧',
    icon: '🎙️',
    color: 'orange',
    headerBg: 'bg-orange-500/10',
    headerBorder: 'border-orange-500/20',
    headerText: 'text-orange-200',
    accent: 'border-l-orange-400',
  },
  other: {
    label: '其他',
    icon: '📝',
    color: 'slate',
    headerBg: 'bg-slate-500/10',
    headerBorder: 'border-slate-500/20',
    headerText: 'text-slate-200',
    accent: 'border-l-slate-400',
  },
}

function getTypeMeta(type) {
  return TYPE_META[type] || TYPE_META.other
}

const SEVERITY_BADGE = {
  high:   { label: '高', bg: 'bg-red-500/20',   text: 'text-red-200' },
  medium: { label: '中', bg: 'bg-yellow-500/20', text: 'text-yellow-200' },
  low:    { label: '低', bg: 'bg-blue-500/20',   text: 'text-blue-200' },
}

export default function RealTimeCorrectionPanel({
  originalText = '',
  optimizedText = '',
  explanation = '',
  corrections = [],
  onPlay,
  onClose,
  variant = 'sidebar',
  className = '',
}) {
  // 每个 type 一个折叠状态；默认全部展开
  const [collapsed, setCollapsed] = useState({})

  // 按 type 分组
  const grouped = corrections.reduce((acc, c) => {
    const t = c.type || 'other'
    if (!acc[t]) acc[t] = []
    acc[t].push(c)
    return acc
  }, {})

  // 出现过的 type 顺序（按 corrections 顺序）
  const orderedTypes = []
  corrections.forEach(c => {
    const t = c.type || 'other'
    if (!orderedTypes.includes(t)) orderedTypes.push(t)
  })

  const toggle = (type) => setCollapsed(prev => ({ ...prev, [type]: !prev[type] }))

  return (
    <aside
      className={[
        variant === 'sidebar'
          ? 'w-full lg:w-80 xl:w-96 shrink-0 h-full'
          : 'w-full',
        'bg-slate-900/80 backdrop-blur-sm',
        variant === 'sidebar' ? 'border-l border-white/5' : '',
        'flex flex-col',
        className,
      ].join(' ')}
      aria-label="实时纠错面板"
    >
      {/* 头部 */}
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">✨</span>
          <h2 className="text-sm font-semibold text-white truncate">实时纠错</h2>
          {corrections.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 font-medium">
              {corrections.length} 处
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="关闭纠错面板"
          >
            ✕
          </button>
        )}
      </header>

      {/* 内容滚动区 */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
        {/* ===== 1. 原文 / 优化句对比区 ===== */}
        {(originalText || optimizedText) && (
          <section className="rounded-xl bg-slate-800/60 border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-slate-800/80 border-b border-white/5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">原文 vs 优化</span>
            </div>
            <div className="p-3 space-y-2.5">
              {originalText && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" aria-hidden="true" />
                    <span className="text-[10px] text-red-300 font-medium">原文</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-3 border-l-2 border-red-400/30 line-through decoration-red-400/40">
                    {originalText}
                  </p>
                </div>
              )}
              {optimizedText && (
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                      <span className="text-[10px] text-emerald-300 font-medium">优化后</span>
                    </div>
                    {onPlay && (
                      <button
                        onClick={() => onPlay(optimizedText)}
                        className="flex items-center gap-1 text-[10px] text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded transition-colors"
                        aria-label="播放优化句"
                      >
                        <span>🔊</span>
                        <span>播放</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-white font-medium leading-relaxed pl-3 border-l-2 border-emerald-400/60">
                    {optimizedText}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===== 2. 综合修改说明 ===== */}
        {explanation && (
          <section className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/15 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span>💬</span>
              <span className="text-[10px] uppercase tracking-wider text-indigo-200 font-semibold">综合说明</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-line">
              {explanation}
            </p>
          </section>
        )}

        {/* ===== 3. 分项纠错模块 ===== */}
        {orderedTypes.length > 0 && (
          <div className="space-y-2">
            {orderedTypes.map(type => {
              const meta = getTypeMeta(type)
              const items = grouped[type] || []
              const isCollapsed = !!collapsed[type]

              return (
                <section
                  key={type}
                  className={`rounded-xl border ${meta.headerBorder} bg-slate-800/40 overflow-hidden border-l-2 ${meta.accent}`}
                >
                  {/* 模块头部（可点击折叠） */}
                  <button
                    onClick={() => toggle(type)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 ${meta.headerBg} hover:bg-slate-800/60 transition-colors`}
                    aria-expanded={!isCollapsed}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{meta.icon}</span>
                      <span className={`text-xs font-semibold ${meta.headerText} truncate`}>
                        {meta.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.headerBg} ${meta.headerText} font-medium shrink-0`}>
                        {items.length}
                      </span>
                    </div>
                    <span className={`text-slate-400 text-xs transition-transform shrink-0 ${isCollapsed ? '-rotate-90' : ''}`}>
                      ▾
                    </span>
                  </button>

                  {/* 模块内容 */}
                  {!isCollapsed && (
                    <div className="divide-y divide-white/5">
                      {items.map((c, i) => (
                        <CorrectionItem key={i} correction={c} meta={meta} onPlay={onPlay} />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        {/* 空状态 */}
        {corrections.length === 0 && !explanation && (
          <div className="text-center py-8 text-slate-500 text-sm">
            <div className="text-3xl mb-2 opacity-50">✨</div>
            <p>暂无纠错内容</p>
            <p className="text-xs mt-1 text-slate-600">说一句英文，AI 会实时分析</p>
          </div>
        )}
      </div>
    </aside>
  )
}

/**
 * 单条纠错项
 */
function CorrectionItem({ correction, meta, onPlay }) {
  const sev = correction.severity && SEVERITY_BADGE[correction.severity]
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {sev && (
            <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${sev.bg} ${sev.text}`}>
              {sev.label}
            </span>
          )}
          <span className="text-[10px] text-slate-500 uppercase">{meta.label}</span>
        </div>
      </div>

      {/* 错误原文 + 修改 */}
      {(correction.original || correction.correction) && (
        <div className="mb-1.5 space-y-1">
          {correction.original && (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 shrink-0">原：</span>
              <span className="text-xs text-red-300 line-through decoration-red-400/50 break-all">
                {correction.original}
              </span>
            </div>
          )}
          {correction.correction && (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 shrink-0">改：</span>
              <span className="text-xs text-emerald-300 font-medium break-all">
                {correction.correction}
              </span>
              {onPlay && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPlay(correction.correction) }}
                  className="text-[10px] text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded transition-colors shrink-0"
                  aria-label="播放修改后的表达"
                  title="播放标准发音"
                >
                  🔊
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 详细说明 */}
      {correction.explanation && (
        <p className="text-xs text-slate-300 leading-relaxed">
          {correction.explanation}
        </p>
      )}
      {!correction.explanation && correction.suggestion && (
        <p className="text-xs text-slate-300 leading-relaxed">
          {correction.suggestion}
        </p>
      )}
    </div>
  )
}
