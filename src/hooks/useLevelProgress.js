import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'ai-coach-level-progress'

/**
 * 关卡进度管理 Hook
 *
 * 数据结构:
 * {
 *   "interview": {
 *     highestUnlocked: 0,        // 已解锁的最高关卡索引
 *     completed: [0, 1],         // 已通关的关卡索引列表
 *     bestScores: { 0: 85, 1: 92 },  // 每个关卡的最佳得分
 *     badges: ["interview"]      // 已获得的勋章列表
 *   },
 *   ...
 * }
 */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    // 确保每个场景有默认值
    Object.keys(data).forEach(key => {
      if (!data[key].highestUnlocked) data[key].highestUnlocked = 0
      if (!data[key].completed) data[key].completed = []
      if (!data[key].bestScores) data[key].bestScores = {}
      if (!data[key].badges) data[key].badges = []
    })
    return data
  } catch {
    return {}
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* quota exceeded — silently fail */ }
}

export function useLevelProgress() {
  const [progress, setProgress] = useState(loadProgress)

  // 跨标签页同步
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY) {
        try { setProgress(JSON.parse(e.newValue || '{}')) } catch {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  /** 获取场景进度 */
  const getSceneProgress = useCallback((sceneId) => {
    const p = progress[sceneId] || { highestUnlocked: 0, completed: [], bestScores: {}, badges: [] }
    return { ...p, highestUnlocked: p.highestUnlocked ?? 0, completed: p.completed ?? [], bestScores: p.bestScores ?? {}, badges: p.badges ?? [] }
  }, [progress])

  /** 关卡是否已解锁 */
  const isLevelUnlocked = useCallback((sceneId, levelIndex) => {
    const p = getSceneProgress(sceneId)
    return levelIndex <= p.highestUnlocked
  }, [getSceneProgress])

  /** 关卡是否已通关 */
  const isLevelCompleted = useCallback((sceneId, levelIndex) => {
    const p = getSceneProgress(sceneId)
    return p.completed.includes(levelIndex)
  }, [getSceneProgress])

  /** 场景是否全部通关 */
  const isSceneAllCompleted = useCallback((sceneId, totalLevels) => {
    const p = getSceneProgress(sceneId)
    return p.completed.length >= totalLevels
  }, [getSceneProgress])

  /** 已完成的关卡数 */
  const getCompletedCount = useCallback((sceneId) => {
    const p = getSceneProgress(sceneId)
    return p.completed.length
  }, [getSceneProgress])

  /** 是否已获得勋章 */
  const hasBadge = useCallback((sceneId) => {
    const p = getSceneProgress(sceneId)
    return p.badges?.includes(sceneId) || false
  }, [getSceneProgress])

  /** 标记关卡通关 */
  const completeLevel = useCallback((sceneId, levelIndex, score) => {
    const data = loadProgress()
    if (!data[sceneId]) {
      data[sceneId] = { highestUnlocked: 0, completed: [], bestScores: {}, badges: [] }
    }
    const sp = data[sceneId]

    // 记录通关
    if (!sp.completed.includes(levelIndex)) {
      sp.completed.push(levelIndex)
    }

    // 更新最佳得分
    const prev = sp.bestScores[levelIndex] ?? 0
    sp.bestScores[levelIndex] = Math.max(prev, score)

    // 解锁下一关
    if (levelIndex + 1 > sp.highestUnlocked) {
      sp.highestUnlocked = levelIndex + 1
    }

    saveProgress(data)
    setProgress(data)
    return data
  }, [])

  /** 颁发勋章 */
  const awardBadge = useCallback((sceneId) => {
    const data = loadProgress()
    if (!data[sceneId]) {
      data[sceneId] = { highestUnlocked: 0, completed: [], bestScores: {}, badges: [] }
    }
    if (!data[sceneId].badges) data[sceneId].badges = []
    if (!data[sceneId].badges.includes(sceneId)) {
      data[sceneId].badges.push(sceneId)
    }
    saveProgress(data)
    setProgress(data)
    return data
  }, [])

  /** 重置某个场景的进度（调试用） */
  const resetProgress = useCallback((sceneId) => {
    const data = loadProgress()
    delete data[sceneId]
    saveProgress(data)
    setProgress(data)
  }, [])

  return {
    progress,
    getSceneProgress,
    isLevelUnlocked,
    isLevelCompleted,
    isSceneAllCompleted,
    getCompletedCount,
    hasBadge,
    completeLevel,
    awardBadge,
    resetProgress,
  }
}