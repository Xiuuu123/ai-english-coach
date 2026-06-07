import { useState, useEffect, useCallback } from 'react'

/**
 * 跨会话学习进度追踪器
 *
 * v3 增强：
 * - 词汇银行追踪（用户常犯词汇）
 * - 错误历史记录（检测重复错误）
 * - 弱点领域分析 + 改进建议
 * - localStorage 持久化
 */

const STORAGE_KEY = 'ai-coach-progress'

const DEFAULT_STATE = {
  totalSessions: 0,
  totalMessages: 0,
  totalCorrections: 0,
  averageScore: 0,
  scoreHistory: [],       // [{ date, sceneId, score }]
  sceneStats: {},         // { interview: { count, avgScore }, ... }
  weakAreas: {},          // { grammar: count, vocabulary: count, ... }
  streakDays: 0,
  lastPracticeDate: null,
  milestones: [],         // ['first_session', 'score_80+', '10_messages', ...]
  /** v3: 词汇银行 — 记录用户常犯的词汇和短语 */
  wordBank: {},           // { "experience": { count: 3, type: "grammar", correct: "experience of" }, ... }
  /** v3: 错误历史 — 用于检测重复错误 */
  errorHistory: [],       // [{ original, corrected, type, date, sceneId }]
  /** v8: 训练历史 — 详细记录每次练习会话 */
  sessionHistory: [],     // [{ id, sceneId, sceneName, date, score, dimensions, wordCount, corrections, rounds, levelIndex }]
}

export function useProgressTracker() {
  const [state, setState] = useState(() => loadState())

  // 每次 state 变化自动保存
  useEffect(() => {
    saveState(state)
  }, [state])

  /** 记录一次练习会话结束 */
  const recordSession = useCallback((sessionData) => {
    const {
      sceneId,
      sceneName,
      messageCount,
      corrections,
      averageScore,
      scores = [],
      correctionTypes = [],
      /** v3: 纠错详情（含 original/corrected/type） */
      correctionDetails = [],
      /** v8: 更多会话详情 */
      dimensions = null,
      totalWords = 0,
      levelIndex = 0,
    } = sessionData

    setState(prev => {
      const today = new Date().toISOString().split('T')[0]

      // 连续天数计算
      let streakDays = prev.streakDays
      if (prev.lastPracticeDate === today) {
        // 今天已经练过了，不增加
      } else if (prev.lastPracticeDate === yesterday()) {
        streakDays += 1
      } else if (prev.lastPracticeDate !== today) {
        streakDays = 1
      }

      // 场景统计
      const sceneStats = { ...prev.sceneStats }
      if (!sceneStats[sceneId]) sceneStats[sceneId] = { count: 0, avgScore: 0, totalScore: 0 }
      sceneStats[sceneId].count += 1
      sceneStats[sceneId].totalScore += averageScore
      sceneStats[sceneId].avgScore = Math.round(sceneStats[sceneId].totalScore / sceneStats[sceneId].count)

      // 弱项统计
      const weakAreas = { ...prev.weakAreas }
      correctionTypes.forEach(type => {
        weakAreas[type] = (weakAreas[type] || 0) + 1
      })

      // ===== v3: 词汇银行 — 追踪用户常犯词汇 =====
      const wordBank = { ...prev.wordBank }
      correctionDetails.forEach(c => {
        if (!c.original) return
        const key = c.original.toLowerCase().trim()
        if (!wordBank[key]) {
          wordBank[key] = { count: 0, type: c.type || 'other', correct: c.corrected || '' }
        }
        wordBank[key].count += 1
        // 更新纠错类型和正确版本
        if (c.type && c.type !== 'other') wordBank[key].type = c.type
        if (c.corrected) wordBank[key].correct = c.corrected
      })

      // ===== v3: 错误历史 — 用于检测重复错误 =====
      const errorHistory = [...prev.errorHistory]
      correctionDetails.forEach(c => {
        if (c.original && c.corrected) {
          errorHistory.push({
            original: c.original.toLowerCase().trim(),
            corrected: c.corrected,
            type: c.type || 'other',
            date: today,
            sceneId,
          })
        }
      })
      // 只保留最近 50 条
      const trimmedErrorHistory = errorHistory.slice(-50)

      // 分数历史（保留最近30条）
      const scoreHistory = [...prev.scoreHistory, { date: today, sceneId, score: averageScore }].slice(-30)

      // 总平均分（加权）
      const totalMsgs = prev.totalMessages + messageCount
      const newAvg = prev.totalSessions > 0
        ? Math.round((prev.averageScore * prev.totalSessions + averageScore) / (prev.totalSessions + 1))
        : averageScore

      // 成就检测
      const milestones = [...prev.milestones]
      if (prev.totalSessions === 0) milestones.push('first_session')
      if (averageScore >= 80 && !milestones.includes('score_80+')) milestones.push('score_80+')
      if (totalMsgs + messageCount >= 10 && !milestones.includes('10_messages')) milestones.push('10_messages')
      if (streakDays >= 3 && !milestones.includes('streak_3')) milestones.push('streak_3')

      // v8: 训练历史记录 — 保留最近 50 条
      const sessionEntry = {
        id: `${today}-${prev.totalSessions + 1}`,
        sceneId,
        sceneName: sceneName || sceneId,
        date: today,
        score: averageScore,
        dimensions: dimensions || {},
        wordCount: totalWords,
        corrections,
        rounds: messageCount,
        levelIndex,
      }
      const sessionHistory = [...prev.sessionHistory, sessionEntry].slice(-50)

      return {
        totalSessions: prev.totalSessions + 1,
        totalMessages: totalMsgs,
        totalCorrections: prev.totalCorrections + corrections,
        averageScore: newAvg,
        scoreHistory,
        sceneStats,
        weakAreas,
        streakDays,
        lastPracticeDate: today,
        milestones,
        wordBank,
        errorHistory: trimmedErrorHistory,
        sessionHistory,
      }
    })
  }, [])

  /** 获取某个场景的历史最佳分数 */
  const getSceneBest = useCallback((sceneId) => {
    const history = state.scoreHistory.filter(s => s.sceneId === sceneId)
    if (!history.length) return null
    return Math.max(...history.map(s => s.score))
  }, [state])

  /** 获取趋势方向（up/down/stable） */
  const getTrend = useCallback(() => {
    const h = state.scoreHistory
    if (h.length < 3) return 'stable'
    const recent = h.slice(-3).reduce((a, b) => a + b.score, 0) / 3
    const older = h.slice(-6, -3).length
      ? h.slice(-6, -3).reduce((a, b) => a + b.score, 0) / h.slice(-6, -3).length
      : recent
    if (recent > older + 3) return 'up'
    if (recent < older - 3) return 'down'
    return 'stable'
  }, [state])

  /** 重置所有进度 */
  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE })
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  /** v3: 检测重复错误 — 返回用户重复犯的错误列表 */
  const getRepeatErrors = useCallback(() => {
    const freq = {}
    const details = {}
    state.errorHistory.forEach(e => {
      const key = e.original
      freq[key] = (freq[key] || 0) + 1
      if (!details[key]) details[key] = { ...e }
    })
    return Object.entries(freq)
      .filter(([, count]) => count >= 2)
      .map(([original, count]) => ({ ...details[original], count }))
      .sort((a, b) => b.count - a.count)
  }, [state])

  /** v3: 获取词汇银行 — 按频率排序 */
  const getWordBankList = useCallback(() => {
    return Object.entries(state.wordBank)
      .map(([word, info]) => ({ word, ...info }))
      .sort((a, b) => b.count - a.count)
  }, [state])

  /** v3: 获取弱点领域分析 */
  const getWeakAreaAnalysis = useCallback(() => {
    const total = Object.values(state.weakAreas).reduce((s, v) => s + v, 0) || 1
    const typeMap = {
      grammar: { label: '语法', icon: '📝', suggestion: '多练习句子结构，注意时态和主谓一致' },
      vocabulary: { label: '词汇', icon: '📖', suggestion: '扩充常用词汇，学习同义词和搭配' },
      pronunciation: { label: '发音', icon: '🗣️', suggestion: '多听母语者发音，练习音节和重音' },
      expression: { label: '表达', icon: '💬', suggestion: '学习地道表达方式，避免中式英语' },
    }
    return Object.entries(state.weakAreas)
      .map(([type, count]) => ({
        type,
        count,
        percent: Math.round((count / total) * 100),
        ...(typeMap[type] || { label: type, icon: '📌', suggestion: '多加练习' }),
      }))
      .sort((a, b) => b.count - a.count)
  }, [state])

  return {
    state,
    recordSession,
    getSceneBest,
    getTrend,
    reset,
    getRepeatErrors,
    getWordBankList,
    getWeakAreaAnalysis,
  }
}

// ===== 工具函数 =====

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
