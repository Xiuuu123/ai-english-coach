import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * 输入模式管理 Hook
 *
 * 功能：
 * 1. 追踪当前输入模式：voice（语音） / text（文字）
 * 2. 自动检测：开始录音 → voice；输入框聚焦 → text
 * 3. 持久化：localStorage `aiec.last_input_mode`（下次进入自动恢复）
 * 4. 提供 setMode / getMode / onChange API
 *
 * 模式影响：
 * - 评分维度（4 维语音 vs 3 维文字）
 * - 纠错面板内容（保留发音 vs 隐藏发音）
 * - 进度条标签
 */

const STORAGE_KEY = 'aiec.last_input_mode'

/** 从 localStorage 读取上次模式 */
function loadLastMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'text' ? 'text' : 'voice' // 默认 voice
  } catch {
    return 'voice'
  }
}

export function useInputMode() {
  const [mode, setModeState] = useState(loadLastMode)
  // 记录最近一次模式变更的来源（用于 UI 反馈）
  const lastChangeRef = useRef({ mode, source: 'init', at: Date.now() })

  const setMode = useCallback((newMode, source = 'manual') => {
    if (newMode !== 'voice' && newMode !== 'text') return
    setModeState(prev => {
      if (prev === newMode) return prev
      lastChangeRef.current = { mode: newMode, source, at: Date.now() }
      try { localStorage.setItem(STORAGE_KEY, newMode) } catch {}
      return newMode
    })
  }, [])

  // 切换模式快捷方法
  const toggleMode = useCallback((source = 'manual') => {
    setMode(mode === 'voice' ? 'text' : 'voice', source)
  }, [mode, setMode])

  // 自动切换（录音/输入时调用）
  const onVoiceStart = useCallback(() => setMode('voice', 'voice-start'), [setMode])
  const onTextInput = useCallback(() => setMode('text', 'text-input'), [setMode])

  return {
    mode,           // 'voice' | 'text'
    isVoice: mode === 'voice',
    isText: mode === 'text',
    setMode,
    toggleMode,
    onVoiceStart,
    onTextInput,
  }
}

/**
 * 工具：模式中文标签
 */
export const MODE_META = {
  voice: {
    label: '语音模式',
    short: '🎤 语音',
    color: 'emerald',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-400/30',
    rule: '发音 + 自信度 + 语法',
    priority: ['pronunciation', 'grammar', 'expression'],
  },
  text: {
    label: '文字模式',
    short: '✏️ 文字',
    color: 'indigo',
    bgClass: 'bg-indigo-500/15',
    textClass: 'text-indigo-300',
    borderClass: 'border-indigo-400/30',
    rule: '表达地道度 + 语法 + 词汇',
    priority: ['grammar', 'vocabulary', 'expression'],
  },
}
