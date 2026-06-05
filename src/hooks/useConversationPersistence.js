import { useState, useEffect } from 'react'

/**
 * 对话持久化 Hook
 * 将对话消息保存到 sessionStorage，刷新页面后自动恢复
 * 场景切换时自动清除上一场景的对话
 */
const STORAGE_PREFIX = 'ai-coach-chat-'
const MAX_MESSAGES = 100 // 最多保存100条，防止存储过大

export function useConversationPersistence(sceneId) {
  const [messages, setMessages] = useState([])
  const [isRestored, setIsRestored] = useState(false)
  const storageKey = `${STORAGE_PREFIX}${sceneId}`

  // 页面加载时恢复对话
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(0, MAX_MESSAGES))
        }
      }
    } catch { /* 解析失败则忽略 */ }
    setIsRestored(true)
  }, [storageKey])

  // 消息变化时保存
  useEffect(() => {
    if (!isRestored || messages.length === 0) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_MESSAGES)))
    } catch { /* 存储满则忽略 */ }
  }, [messages, storageKey, isRestored])

  /** 清除当前场景的缓存（结束练习或重新开始时调用） */
  function clearConversation() {
    setMessages([])
    try {
      sessionStorage.removeItem(storageKey)
    } catch { /* 静默 */ }
  }

  return { messages, setMessages, isRestored, clearConversation }
}