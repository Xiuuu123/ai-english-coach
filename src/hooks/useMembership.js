import { useState, useEffect, useCallback } from 'react'

/**
 * 会员与免费次数管理 Hook
 *
 * 功能：
 * - 会员状态永久保存到 localStorage（vip 字段）
 * - 每个场景独立计数：freeUsage[sceneId]
 * - 默认每个场景免费 7 次
 * - 开通会员后所有场景无限次
 *
 * 数据结构：
 * {
 *   vip: true | false,
 *   freeUsage: { interview: 3, meeting: 7, ordering: 0, ... }
 * }
 */

const STORAGE_KEY = 'ai-coach-membership'
const FREE_LIMIT = 7 // 每个场景免费次数

/**
 * 读取本地存储
 */
function loadMembership() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    return {
      vip: !!parsed.vip,
      freeUsage: parsed.freeUsage && typeof parsed.freeUsage === 'object' ? parsed.freeUsage : {},
    }
  } catch {
    return defaultState()
  }
}

function defaultState() {
  return { vip: false, freeUsage: {} }
}

/**
 * 保存到 localStorage
 */
function saveMembership(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    // 触发 storage 事件，让其他标签页 / 组件感知变化
    window.dispatchEvent(new Event('membership-changed'))
  } catch {
    // localStorage 不可用时静默失败
  }
}

export function useMembership() {
  const [state, setState] = useState(() => loadMembership())

  // 监听其他组件/标签页的更新
  useEffect(() => {
    const onChange = () => setState(loadMembership())
    window.addEventListener('membership-changed', onChange)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) onChange()
    })
    return () => {
      window.removeEventListener('membership-changed', onChange)
    }
  }, [])

  /**
   * 当前场景已用次数
   */
  const getUsage = useCallback((sceneId) => {
    if (!sceneId) return 0
    return state.freeUsage[sceneId] || 0
  }, [state.freeUsage])

  /**
   * 当前场景剩余免费次数
   * 会员返回 Infinity
   */
  const getRemaining = useCallback((sceneId) => {
    if (state.vip) return Infinity
    const used = state.freeUsage[sceneId] || 0
    return Math.max(0, FREE_LIMIT - used)
  }, [state.vip, state.freeUsage])

  /**
   * 是否达到免费上限
   * 会员永远 false
   */
  const isLimitReached = useCallback((sceneId) => {
    if (state.vip) return false
    return (state.freeUsage[sceneId] || 0) >= FREE_LIMIT
  }, [state.vip, state.freeUsage])

  /**
   * 检查是否可发送（消费一次免费次数）
   * 会员总是返回 true
   * 非会员：未达上限返回 true；已达上限返回 false
   */
  const canSend = useCallback((sceneId) => {
    if (state.vip) return true
    return (state.freeUsage[sceneId] || 0) < FREE_LIMIT
  }, [state.vip, state.freeUsage])

  /**
   * 消费一次免费次数
   * - 会员直接返回 true
   * - 非会员：可消费时 +1 并保存，返回 true；已达上限返回 false
   */
  const consumeUsage = useCallback((sceneId) => {
    if (state.vip) return true
    const used = state.freeUsage[sceneId] || 0
    if (used >= FREE_LIMIT) return false

    const newState = {
      ...state,
      freeUsage: {
        ...state.freeUsage,
        [sceneId]: used + 1,
      },
    }
    setState(newState)
    saveMembership(newState)
    return true
  }, [state])

  /**
   * 开通会员
   */
  const activateVip = useCallback(() => {
    const newState = { ...state, vip: true }
    setState(newState)
    saveMembership(newState)
  }, [state])

  /**
   * 取消会员（仅测试用）
   */
  const deactivateVip = useCallback(() => {
    const newState = { ...state, vip: false }
    setState(newState)
    saveMembership(newState)
  }, [state])

  /**
   * 重置所有数据
   */
  const resetAll = useCallback(() => {
    const newState = defaultState()
    setState(newState)
    saveMembership(newState)
  }, [])

  return {
    vip: state.vip,
    freeUsage: state.freeUsage,
    freeLimit: FREE_LIMIT,
    getUsage,
    getRemaining,
    isLimitReached,
    canSend,
    consumeUsage,
    activateVip,
    deactivateVip,
    resetAll,
  }
}

/** 导出常量供组件使用 */
export const FREE_CHAT_LIMIT = FREE_LIMIT
