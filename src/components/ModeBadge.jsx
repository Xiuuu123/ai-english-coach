import { MODE_META } from '../hooks/useInputMode'

/**
 * 输入模式徽章（深色科技风 + 发光）
 *
 * 三种使用场景：
 * 1. 顶部状态条：「🎤 语音模式 / ✏️ 文字模式」
 * 2. 消息气泡顶部：小尺寸标签
 * 3. 评分区域：完整模式名 + 规则说明
 *
 * Props:
 *  - mode: 'voice' | 'text'
 *  - size: 'sm' | 'md' | 'lg'
 *  - showRule: boolean   是否显示评分规则说明
 *  - className: string
 */
export default function ModeBadge({ mode = 'voice', size = 'md', showRule = false, className = '' }) {
  const meta = MODE_META[mode] || MODE_META.voice

  const sizes = {
    sm: { box: 'text-[9px] px-1.5 py-0.5 gap-0.5', iconSize: 'text-[10px]' },
    md: { box: 'text-[10px] sm:text-[11px] px-2 py-0.5 gap-1', iconSize: 'text-xs' },
    lg: { box: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5', iconSize: 'text-sm' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className={`inline-flex flex-col items-end gap-1 ${className}`}>
      <span
        className={`inline-flex items-center font-bold rounded-full border ${s.box} ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
        title={meta.rule}
      >
        <span className={s.iconSize}>{meta.short.split(' ')[0]}</span>
        <span>{meta.label}</span>
      </span>
      {showRule && (
        <span className="text-[9px] sm:text-[10px] text-slate-500 leading-snug max-w-[200px] text-right">
          {meta.rule}
        </span>
      )}
    </div>
  )
}
