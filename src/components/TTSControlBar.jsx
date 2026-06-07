import { useState, useEffect } from 'react'

/**
 * 口语对话控制栏 v1
 *
 * 三组开关：
 * 1. 语速 0.8x / 1.0x / 1.2x — 蓝色高亮
 * 2. 口音 美式 / 英式 — 单选按钮
 * 3. 风格 口语化 / 书面化 — 切换按钮
 *
 * 设计语言：与现有 ChatPage 深色系（slate-800 / indigo）保持一致
 * 选中态：bg-indigo-500/20 text-indigo-300 ring-indigo-400
 * 未选中：bg-slate-700/40 text-slate-300 hover:bg-slate-700/60
 */

export const SPEED_OPTIONS = [
  { value: 0.8, label: '0.8x', desc: '慢速' },
  { value: 1.0, label: '1.0x', desc: '正常' },
  { value: 1.2, label: '1.2x', desc: '快速' },
]

export const ACCENT_OPTIONS = [
  { value: 'us', label: '美式', flag: '🇺🇸', desc: 'en-US' },
  { value: 'uk', label: '英式', flag: '🇬🇧', desc: 'en-GB' },
]

export const STYLE_OPTIONS = [
  { value: 'casual', label: '口语化', icon: '💬', desc: '日常对话、短句、俚语' },
  { value: 'formal', label: '书面化', icon: '📝', desc: '正式表达、完整句式' },
]

export default function TTSControlBar({
  rate = 1.0,
  accent = 'us',
  style = 'casual',
  onRateChange,
  onAccentChange,
  onStyleChange,
  // 紧凑模式：只显示当前值 + 点击展开弹窗
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false)

  // 当前显示的概要
  const currentSpeedLabel = SPEED_OPTIONS.find(s => s.value === rate)?.label || '1.0x'
  const currentAccentLabel = ACCENT_OPTIONS.find(a => a.value === accent)?.label || '美式'
  const currentStyleLabel = STYLE_OPTIONS.find(s => s.value === style)?.label || '口语化'

  if (compact) {
    return (
      <div className="relative">
        {/* 触发按钮 */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 text-xs transition-colors border border-slate-600/40"
          aria-label="TTS 设置"
          title="语速 / 口音 / 风格"
        >
          <span>⚙️</span>
          <span className="hidden sm:inline">{currentSpeedLabel}</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">{currentAccentLabel}</span>
        </button>

        {/* 弹出的设置面板 */}
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 p-4 space-y-3 animate-scaleUp">
              <TTSControlBody
                rate={rate}
                accent={accent}
                style={style}
                onRateChange={onRateChange}
                onAccentChange={onAccentChange}
                onStyleChange={onStyleChange}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  // 完整展开模式（直接显示在页面上）
  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/40 p-3 sm:p-4 space-y-3">
      <TTSControlBody
        rate={rate}
        accent={accent}
        style={style}
        onRateChange={onRateChange}
        onAccentChange={onAccentChange}
        onStyleChange={onStyleChange}
      />
    </div>
  )
}

function TTSControlBody({ rate, accent, style, onRateChange, onAccentChange, onStyleChange }) {
  return (
    <>
      {/* 语速 */}
      <div>
        <div className="text-[10px] sm:text-xs text-slate-400 mb-1.5 font-medium">语速</div>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="语速">
          {SPEED_OPTIONS.map(opt => {
            const isActive = rate === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onRateChange?.(opt.value)}
                role="radio"
                aria-checked={isActive}
                className={`px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/60 shadow-sm'
                    : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 active:bg-slate-700/80'}`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 口音 */}
      <div>
        <div className="text-[10px] sm:text-xs text-slate-400 mb-1.5 font-medium">口音</div>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="口音">
          {ACCENT_OPTIONS.map(opt => {
            const isActive = accent === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onAccentChange?.(opt.value)}
                role="radio"
                aria-checked={isActive}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/60 shadow-sm'
                    : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 active:bg-slate-700/80'}`}
                title={opt.desc}
              >
                <span className="text-base">{opt.flag}</span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 风格 */}
      <div>
        <div className="text-[10px] sm:text-xs text-slate-400 mb-1.5 font-medium">风格</div>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="对话风格">
          {STYLE_OPTIONS.map(opt => {
            const isActive = style === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onStyleChange?.(opt.value)}
                role="radio"
                aria-checked={isActive}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/60 shadow-sm'
                    : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 active:bg-slate-700/80'}`}
                title={opt.desc}
              >
                <span className="text-base">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/**
 * TTS 设置 Hook — 自动持久化到 localStorage
 * 默认值：1.0x / 美式 / 口语化
 */
export function useTTSSettings() {
  const STORAGE_KEY = 'tts_settings_v1'

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          rate: typeof parsed.rate === 'number' ? parsed.rate : 1.0,
          accent: parsed.accent === 'uk' ? 'uk' : 'us',
          style: parsed.style === 'formal' ? 'formal' : 'casual',
        }
      }
    } catch { /* ignore */ }
    return { rate: 1.0, accent: 'us', style: 'casual' }
  })

  // 持久化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch { /* ignore */ }
  }, [settings])

  return {
    ...settings,
    setRate: (rate) => setSettings(s => ({ ...s, rate })),
    setAccent: (accent) => setSettings(s => ({ ...s, accent })),
    setStyle: (style) => setSettings(s => ({ ...s, style })),
  }
}
