import { scenes } from '../data/scenes'

// LLM API 配置 - 使用环境变量或默认值
const API_URL = import.meta.env.VITE_API_URL || 'https://api.openai.com/v1/chat/completions'
const MODEL = import.meta.env.VITE_MODEL || 'gpt-4o-mini'

/** 自动重试次数 */
export const MAX_RETRIES = 2

/**
 * 调用 LLM 获取 AI 回复和纠错信息
 * @param {string} sceneId - 场景 ID
 * @param {Array} history - 对话历史 [{ role: 'user'/'assistant', content: string }]
 * @returns {Promise<{reply, corrections[], pronunciation_tips[], score}>}
 */
export async function sendMessage(sceneId, history) {
  const scene = scenes.find(s => s.id === sceneId)
  if (!scene) throw new Error(`Unknown scene: ${sceneId}`)

  // 构建消息：系统提示 + 对话历史
  const formattedHistory = history.map(m => ({
    role: m.role,
    content: m.role === 'assistant' ? (m.reply || m.content || '') : (m.content || ''),
  }))

  const messages = [
    { role: 'system', content: scene.systemPrompt },
    ...formattedHistory,
  ]

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error('API Error:', response.status, errBody)
    throw new Error(`API error: ${response.status} - ${errBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  // 解析 AI 返回的内容（支持 [Correction]/[Reply] 格式 或 JSON 格式）
  return parseAIResponse(content)
}

/**
 * 解析 AI 返回的内容，提取纠错和回复
 *
 * 支持两种格式：
 * 1. [Correction]/[Reply] 标签格式（优先）
 * 2. JSON 格式（降级兜底）
 */
function parseAIResponse(content) {
  const text = content.trim()

  // ===== 格式1：[Correction] / [Reply] 标签格式 =====
  const correctionMatch = text.match(/\[Correction\]([\s\S]*?)(?=\[Reply\]|$)/i)
  const replyMatch = text.match(/\[Reply\]([\s\S]*?)$/i)

  if (correctionMatch || replyMatch) {
    const correctionText = correctionMatch?.[1]?.trim() || ''
    const replyText = replyMatch?.[1]?.trim() || text

    // 从 correction 文本中提取纠错对
    const corrections = parseCorrections(correctionText)

    // 从 reply 文本中提取分数
    const score = extractScore(replyText)

    return {
      reply: cleanReply(replyText),
      corrections,
      pronunciationTips: [],
      score,
    }
  }

  // ===== 格式2：JSON 兜底 =====
  let jsonStr = text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```\s*$/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      reply: parsed.reply || text,
      corrections: parsed.corrections || [],
      pronunciationTips: parsed.pronunciation_tips || [],
      score: parsed.score ?? null,
    }
  } catch {
    // 纯文本降级
    return { reply: text, corrections: [], pronunciationTips: [], score: null }
  }
}

/**
 * 从 Correction 文本中解析出纠错对
 * 支持多种表达模式：
 *   - "say X instead of Y"
 *   - "X → Y"
 *   - "better to say 'X' rather than 'Y'"
 */
function parseCorrections(text) {
  if (!text) return []

  const corrections = []

  // 模式1: "instead of '错误'" ... "'正确'"  或  instead of 错误 ... 正确
  const insteadPattern = /instead\s+of\s+(?:["']?)([^"'\n]+?)(?:["']?)(?:\s+(?:rather|than|or)\s+(?:["']?)([^"'\n]+?)(?:["'])?))?/gi
  let match
  while ((match = insteadPattern.exec(text)) !== null) {
    if (match[1] && match[2]) {
      corrections.push({
        original: match[1].trim(),
        corrected: match[2].trim(),
        tip: text.replace(match[0], '').trim().slice(0, 120),
      })
    }
  }

  // 模式2: "say '正确'" / "use '正确'" — 提取建议的正确说法
  if (corrections.length === 0) {
    const sayPattern = /(?:say|use|try|better to say)[:\s]+(["'])([^"']+?)\1/i
    const sayMatch = text.match(sayPattern)
    if (sayMatch) {
      // 尝试从上下文推断原始错误
      const wrongMatch = text.match(/(?:instead\s+of|rather\s+than|not[:\s]+|don't\s+say|avoid[:\s]+)?(["']?)([^"'\n]{2,40}?)(?:["'])?(?:\s*(?:is|are|sounds?|can be)/i)
      corrections.push({
        original: wrongMatch?.[2]?.trim() || '(see above)',
        corrected: sayMatch[2].trim(),
        tip: text.slice(0, 150),
      })
    }
  }

  // 模式3: 如果以上都没匹配到，把整段作为一条纠错提示
  if (corrections.length === 0 && text.length > 5) {
    corrections.push({
      original: '(review your sentence)',
      corrected: '',
      tip: text,
    })
  }

  return corrections.slice(0, 3) // 最多3条
}

/**
 * 从回复文本中提取分数
 * 匹配模式: (Score: 85), (score:85), Score: 85/100 等
 */
function extractScore(text) {
  const patterns = [
    /\(?\s*score\s*[:\-]?\s*(\d{1,3})\s*\/?\d*\s*\)?/i,
    /\(\s*(\d{1,3})\s*\/?\s*100?\s*\)/,
    ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 0 && n <= 100) return n
    }
  }
  return null
}

/**
 * 清理回复文本：移除末尾的分数标注，保留纯对话内容
 */
function cleanReply(text) {
  return text
    .replace(/\(?\s*score\s*[:\-]?\s*\d{1,3}\s*\/?\d*\s*\)?/gi, '') // 移除分数
    .replace(/\(\s*\d{1,3}\s*\/?\s*100?\s*\)/g, '')
    .trim() || text
}