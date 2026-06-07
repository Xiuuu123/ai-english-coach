import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 每日口语练习目标追踪 Hook
 *
 * 功能：
 * 1. 追踪今日累计练习时长（秒）
 * 2. 自动跨日重置（每天 0:00 自动清零）
 * 3. 持久化到 localStorage（aiec.daily_goal）
 * 4. 提供 addPractice / resetToday / getProgress API
 * 5. 监听 storage 事件，跨标签页同步
 *
 * 数据结构：
 * {
 *   date: '2026-06-07',   // YYYY-MM-DD
 *   totalSeconds: 180,    // 今日累计秒数
 *   goalSeconds: 300,     // 目标秒数（默认 5 分钟）
 *   streak: 3,            // 连续打卡天数
 *   lastUpdate: 1234567   // 时间戳
 * }
 */

const STORAGE_KEY = 'aiec.daily_goal'

/** 获取今日日期 YYYY-MM-DD */
function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 从 localStorage 读取 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // 简单类型校验
    if (typeof data.totalSeconds !== 'number') return null
    return data
  } catch {
    return null
  }
}

/** 写入 localStorage */
function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 静默失败
  }
}

/**
 * 检查日期是否需要重置
 * 跨日 → 重置总时长，streak +1（如果昨日有练习）
 */
function rolloverIfNeeded(data) {
  const today = getToday()
  if (data.date === today) return data

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  // 昨日有练习（>=30秒算有效）→ 连续 +1；否则 streak 重置为 0
  const wasYesterday = data.date === yDate
  const hadPracticeYesterday = wasYesterday && data.totalSeconds >= 30
  const newStreak = hadPracticeYesterday ? (data.streak || 0) + 1 : 0

  return {
    date: today,
    totalSeconds: 0,
    goalSeconds: data.goalSeconds || 300,
    streak: newStreak,
    lastUpdate: Date.now(),
  }
}

/**
 * @param {number} goalSeconds - 每日目标秒数，默认 300（5 分钟）
 */
export function useDailyGoal(goalSeconds = 300) {
  const [data, setData] = useState(() => {
    const loaded = loadFromStorage()
    if (!loaded) {
      return {
        date: getToday(),
        totalSeconds: 0,
        goalSeconds,
        streak: 0,
        lastUpdate: Date.now(),
      }
    }
    // 首次加载时检查跨日
    const rolled = rolloverIfNeeded({ ...loaded, goalSeconds: loaded.goalSeconds || goalSeconds })
    return rolled
  })

  // 记录上一次完成状态（用于触发"达成"事件）
  const prevCompletedRef = useRef(data.totalSeconds >= data.goalSeconds)

  /**
   * 增加今日练习时长
   * @param {number} seconds - 新增秒数
   */
  const addPractice = useCallback((seconds) => {
    if (!seconds || seconds <= 0) return
    setData(prev => {
      const rolled = rolloverIfNeeded(prev)
      const newTotal = Math.min(rolled.totalSeconds + seconds, 86400) // 上限 24h
      const next = {
        ...rolled,
        totalSeconds: newTotal,
        lastUpdate: Date.now(),
      }
      saveToStorage(next)

      // 检测是否首次达成
      const wasCompleted = prevCompletedRef.current
      const isCompleted = newTotal >= next.goalSeconds
      if (!wasCompleted && isCompleted) {
        prevCompletedRef.current = true
        // 触发自定义事件，供 UI 展示庆祝动画
        window.dispatchEvent(new CustomEvent('daily-goal-achieved', {
          detail: { totalSeconds: newTotal, goalSeconds: next.goalSeconds, streak: next.streak }
        }))
      }

      return next
    })
  }, [])

  /**
   * 重置今日数据（不重置 streak）
   */
  const resetToday = useCallback(() => {
    setData(prev => {
      const next = {
        ...prev,
        date: getToday(),
        totalSeconds: 0,
        lastUpdate: Date.now(),
      }
      saveToStorage(next)
      prevCompletedRef.current = false
      return next
    })
  }, [])

  /**
   * 修改目标时长（持久化）
   */
  const setGoal = useCallback((newGoal) => {
    setData(prev => {
      const next = { ...prev, goalSeconds: Math.max(30, newGoal) }
      saveToStorage(next)
      return next
    })
  }, [])

  // 跨标签页同步
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const newData = JSON.parse(e.newValue)
          setData(rolloverIfNeeded(newData))
        } catch {
          // 静默
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // 定时检查跨日（每分钟一次，防止长时间挂机未刷新时跨日）
  useEffect(() => {
    const timer = setInterval(() => {
      setData(prev => {
        const today = getToday()
        if (prev.date !== today) {
          const rolled = rolloverIfNeeded(prev)
          saveToStorage(rolled)
          return rolled
        }
        return prev
      })
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  // 计算进度（0-1，可能 > 1 表示超额完成）
  const progress = Math.min(data.totalSeconds / data.goalSeconds, 1)
  // 进度百分比（用于显示，允许 > 100% 表示超额）
  const progressPercent = Math.round((data.totalSeconds / data.goalSeconds) * 100)
  // 是否已完成
  const isCompleted = data.totalSeconds >= data.goalSeconds
  // 剩余秒数（0 表示已完成）
  const remaining = Math.max(data.goalSeconds - data.totalSeconds, 0)

  return {
    // 数据
    totalSeconds: data.totalSeconds,
    goalSeconds: data.goalSeconds,
    streak: data.streak || 0,
    date: data.date,
    // 派生
    progress,
    progressPercent,
    isCompleted,
    remaining,
    // 方法
    addPractice,
    resetToday,
    setGoal,
  }
}

/**
 * 工具函数：秒数 → "X 分 Y 秒" / "X 秒"
 */
export function formatDuration(seconds) {
  const s = Math.floor(seconds)
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  const remS = s % 60
  if (remS === 0) return `${m} 分钟`
  return `${m} 分 ${remS} 秒`
}

/**
 * 工具函数：秒数 → "MM:SS" 计时器样式
 */
export function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const remS = s % 60
  return `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`
}
