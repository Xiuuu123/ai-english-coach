import { useState, useRef, useEffect } from 'react'

/**
 * 错误高亮句子组件 v1
 *
 * 功能：
 * - 接收 { text, errors: [{ word, type, suggestion, ... }] }
 * - 按错误类型给单词添加不同颜色：grammar(语法) 红色 / pronunciation(发音) 橙色 / expression(中式表达) 黄色
 * - 标点不过滤但单独显示（不参与高亮匹配）
 * - 单词 hover 时显示悬浮提示框：错误类型 + 修改建议
 * - 点击单词同样展开提示框
 * - 响应式设计，PC 端悬浮在单词上方，手机端固定底部抽屉
 *
 * 错误类型颜色（与现有 UI 风格统一）：
 * - grammar: 红色（语法错误）
 * - pronunciation: 橙色（发音偏差）
 * - expression: 黄色（中式表达 / 选词不当）
 * - vocabulary: 蓝色（词汇 / 拼写）
 * - other: 灰色（其他）
 */

const TYPE_META = {
  grammar:        { label: '语法错误',   color: 'red',     bg: 'bg-red-500/20',     text: 'text-red-200',     border: 'border-red-400/40',     dot: 'bg-red-400' },
  pronunciation:  { label: '发音偏差',   color: 'orange',  bg: 'bg-orange-500/20',  text: 'text-orange-200',  border: 'border-orange-400/40',  dot: 'bg-orange-400' },
  expression:     { label: '中式表达',   color: 'yellow',  bg: 'bg-yellow-500/20',  text: 'text-yellow-200',  border: 'border-yellow-400/40',  dot: 'bg-yellow-400' },
  vocabulary:     { label: '用词建议',   color: 'blue',    bg: 'bg-blue-500/20',    text: 'text-blue-200',    border: 'border-blue-400/40',    dot: 'bg-blue-400' },
  other:          { label: '其他问题',   color: 'slate',   bg: 'bg-slate-500/20',   text: 'text-slate-200',   border: 'border-slate-400/40',   dot: 'bg-slate-400' },
}

// 默认类型为 grammar，匹配大小写不敏感
function getTypeMeta(type) {
  if (!type) return TYPE_META.grammar
  const t = String(type).toLowerCase()
  return TYPE_META[t] || TYPE_META.grammar
}

/**
 * 拆分文本为 token 数组：
 * - 单词：[a-zA-Z'-]+
 * - 非单词：标点、空格等
 */
function tokenize(text) {
  if (!text) return []
  return text.match(/[a-zA-Z'-]+|[^a-zA-Z'-]+/g) || []
}

/**
 * 匹配错误到 token 上
 * 匹配规则：忽略大小写、去标点后的精确匹配；返回 { tokenIndex, error }
 */
function matchErrorsToTokens(tokens, errors) {
  if (!errors || errors.length === 0) return []

  // 错误按 word 建索引（小写、去标点）
  const errorMap = new Map()
  errors.forEach((e, i) => {
    if (!e?.word) return
    const key = String(e.word).toLowerCase().replace(/[^a-z'-]/g, '')
    if (!key) return
    // 同词多次错误，保留所有
    if (!errorMap.has(key)) errorMap.set(key, [])
    errorMap.get(key).push({ ...e, _idx: i })
  })

  const matched = []
  tokens.forEach((tok, idx) => {
    if (!/^[a-zA-Z'-]+$/.test(tok)) return // 只匹配单词
    const key = tok.toLowerCase().replace(/[^a-z'-]/g, '')
    if (errorMap.has(key)) {
      matched.push({ tokenIndex: idx, token: tok, errors: errorMap.get(key) })
    }
  })

  return matched
}

export default function ErrorHighlightedSentence({ text, errors = [], className = '' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [pinnedIdx, setPinnedIdx] = useState(null) // 移动端点选固定
  const containerRef = useRef(null)

  const tokens = tokenize(text)
  const matches = matchErrorsToTokens(tokens, errors)
  // tokenIndex -> errors[] 映射
  const matchMap = new Map()
  matches.forEach(m => matchMap.set(m.tokenIndex, m.errors))

  if (!text) return null

  // 当前激活的错误（hover 优先，否则 pinned）
  const activeIdx = hoveredIdx ?? pinnedIdx
  const activeErrors = activeIdx !== null ? matchMap.get(activeIdx) : null

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* 句子本体（带高亮） */}
      <p className="text-sm sm:text-[15px] leading-relaxed text-slate-100 break-words">
        {tokens.map((tok, i) => {
          if (!/^[a-zA-Z'-]+$/.test(tok)) {
            // 标点 / 空格：原样渲染
            return <span key={i}>{tok}</span>
          }
          const errs = matchMap.get(i)
          if (!errs) {
            // 正常单词
            return <span key={i} className="text-slate-200">{tok}</span>
          }
          // 错误单词
          const meta = getTypeMeta(errs[0].type)
          const isActive = activeIdx === i
          return (
            <span
              key={i}
              data-error-word
              className={[
                'relative inline-block rounded px-0.5 mx-0.5 transition-all cursor-pointer',
                'border-b-2',
                meta.bg,
                meta.text,
                meta.border,
                isActive ? 'ring-2 ring-white/30 scale-105 shadow-lg' : 'hover:scale-105',
              ].join(' ')}
              onMouseEnter={() => setHoveredIdx(i)}
              onClick={(e) => {
                e.stopPropagation()
                setPinnedIdx(pinnedIdx === i ? null : i)
              }}
              role="button"
              tabIndex={0}
              aria-label={`错误单词: ${tok}, ${errs.length} 处问题`}
            >
              {tok}
              {/* 角标小圆点 */}
              <span className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${meta.dot} ring-1 ring-slate-900`} aria-hidden="true" />
            </span>
          )
        })}
      </p>

      {/* 悬浮提示框 */}
      {activeErrors && activeErrors.length > 0 && (
        <ErrorTooltip
          errors={activeErrors}
          onClose={() => { setHoveredIdx(null); setPinnedIdx(null) }}
          containerRef={containerRef}
        />
      )}
    </div>
  )
}

/**
 * 错误提示框 — 展示错误类型 + 修改建议
 * 位置：PC 端在第一个错误单词下方，手机端固定屏幕底部
 */
function ErrorTooltip({ errors, onClose, containerRef }) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 点击空白处关闭（仅 pinned 状态）
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest('[data-error-word]')) return
      if (e.target.closest('[data-error-tooltip]')) return
      onClose()
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler, { passive: true })
    }, 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [onClose])

  if (isMobile) {
    return (
      <div
        data-error-tooltip
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-32px)] max-w-md
                   bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl
                   border border-white/10 p-3.5 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {errors.map((err, i) => <ErrorDetail key={i} err={err} />)}
      </div>
    )
  }

  // PC 端：浮在容器下方
  return (
    <div
      data-error-tooltip
      className="absolute left-0 top-full mt-1.5 z-30 w-72
                 bg-slate-800/98 backdrop-blur-sm rounded-xl shadow-2xl
                 border border-white/10 p-3 animate-scaleUp"
      onClick={(e) => e.stopPropagation()}
    >
      {errors.map((err, i) => <ErrorDetail key={i} err={err} />)}
    </div>
  )
}

function ErrorDetail({ err }) {
  const meta = getTypeMeta(err.type)
  return (
    <div className={`${meta.bg} ${meta.border} border rounded-lg p-2.5 mb-1.5 last:mb-0`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
        <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.text}`}>
          {meta.label}
        </span>
        {err.severity && (
          <span className="text-[9px] text-slate-500 ml-auto">
            严重度 {err.severity}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-200 leading-relaxed">
        {err.suggestion || err.correction || err.explanation || '建议修改'}
      </div>
    </div>
  )
}
