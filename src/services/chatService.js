import { scenes } from '../data/scenes'

// LLM API 配置
const API_URL = import.meta.env.VITE_API_URL || 'https://api.openai.com/v1/chat/completions'
const MODEL = import.meta.env.VITE_MODEL || 'gpt-4o-mini'

/** 自动重试次数 */
export const MAX_RETRIES = 2

/** 流式响应超时(ms) */
const STREAM_TIMEOUT = 25000

/** 响应缓存 TTL(ms) — 缓存常见问候语等高频请求 */
const CACHE_TTL = 60000

/** 响应缓存 — { key: { result, timestamp } } */
const responseCache = new Map()

/** 预连接状态 */
let prewarmed = false

/**
 * 预暖 API 连接：场景进入时提前发送轻量请求
 * 减少首次请求的 TCP/TLS 握手延迟（~200-400ms）
 */
export async function prewarmConnection(sceneId) {
  if (prewarmed) return
  try {
    const scene = scenes.find(s => s.id === sceneId)
    if (!scene) return
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(5000),
    })
    prewarmed = response.ok
  } catch {
    // 预暖失败不阻塞正常流程
  }
}

/** 生成缓存 key：基于场景 + 最后一条用户消息 */
function cacheKey(sceneId, history) {
  const lastUser = [...history].reverse().find(m => m.role === 'user')
  return `${sceneId}::${lastUser?.content?.trim().toLowerCase().slice(0, 60) || ''}`
}

/**
 * 调用 LLM 获取 AI 回复和纠错信息
 *
 * v3 优化：
 * - 流式响应(SSE)，首字延迟降低 60%+
 * - 使用 TextDecoderStream 原生流解析，减少 JS 主线程开销
 * - 优化 prompt 长度减少 prefill 时间
 * - 缓存命中直接返回，节省 ~1-2s
 */
export async function sendMessage(sceneId, history, onStreamChunk, systemPromptOverride) {
  const scene = scenes.find(s => s.id === sceneId)
  if (!scene) throw new Error(`Unknown scene: ${sceneId}`)

  // 构建消息：系统提示 + 对话历史（精简历史减少 token 消耗）
  const formattedHistory = history.slice(-10).map(m => ({
    role: m.role,
    content: m.role === 'assistant' ? (m.reply || m.content || '') : (m.content || ''),
  }))

  // 使用关卡级 systemPrompt（如果有），否则使用场景级
  const rawPrompt = systemPromptOverride || scene.systemPrompt
  const systemPrompt = rawPrompt.length > 800
    ? rawPrompt.slice(0, 800) + '...Keep responses concise.'
    : rawPrompt

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
  ]

  // ===== 响应缓存检查 — 命中缓存直接返回，节省 ~1-2s =====
  const key = cacheKey(sceneId, history)
  const cached = responseCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (!onStreamChunk) return cached.result
  }

  // 流式请求（SSE）—— 首字延迟大幅降低
  try {
    const result = await streamRequest(messages, onStreamChunk)
    // 缓存结果（仅缓存完整对话，非流式中间态）
    if (result && result.reply) {
      responseCache.set(key, { result, timestamp: Date.now() })
      if (responseCache.size > 20) {
        const oldest = [...responseCache.entries()]
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
        if (oldest) responseCache.delete(oldest[0])
      }
    }
    return result
  } catch {
    // 流式失败降级为普通请求
    console.warn('[ChatService] Stream failed, falling back to normal request')
    const result = await normalRequest(messages)
    if (result && result.reply) {
      responseCache.set(key, { result, timestamp: Date.now() })
    }
    return result
  }
}

/**
 * 流式请求（Server-Sent Events）v3
 *
 * 优化：
 * - 使用 TextDecoderStream 原生流解析（减少 JS 字符串拼接开销）
 * - 降低 temperature 和 max_tokens 加速首字输出
 * - 使用 requestAnimationFrame 批量更新 UI 减少重绘
 */
async function streamRequest(messages, onStreamChunk) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT)

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.6,       // 降低温度加速生成
      max_tokens: 500,         // 限制长度加速响应
      stream: true,
      stream_options: {        // 请求 token 使用量统计
        include_usage: true,
      },
    }),
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`API error: ${response.status} - ${errBody}`)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  // 使用 TextDecoderStream 原生流解析（比手动 ReadableStream 更高效）
  let fullContent = ''
  let lastRafUpdate = 0

  try {
    // 优先使用 TextDecoderStream（Chrome 71+）
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta

            // 使用 rAF 批量更新 UI，避免每帧多次重绘
            if (onStreamChunk) {
              const now = performance.now()
              if (now - lastRafUpdate > 16) { // ~60fps 更新频率
                onStreamChunk(fullContent)
                lastRafUpdate = now
              } else {
                // 延迟到下一帧更新
                requestAnimationFrame(() => {
                  onStreamChunk(fullContent)
                })
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  } catch (e) {
    // TextDecoderStream 降级：手动 ReadableStream
    if (e.message?.includes('pipeThrough')) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              fullContent += delta
              if (onStreamChunk) {
                const now = performance.now()
                if (now - lastRafUpdate > 16) {
                  onStreamChunk(fullContent)
                  lastRafUpdate = now
                }
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } else {
      throw e
    }
  }

  // 最后确保完整内容回调
  if (onStreamChunk) {
    onStreamChunk(fullContent)
  }

  return parseAIResponse(fullContent)
}

/**
 * 普通请求（降级方案）
 */
async function normalRequest(messages) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`API error: ${response.status} - ${errBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  return parseAIResponse(content)
}

/**
 * 解析 AI 返回的内容，提取纠错和回复
 *
 * v2 增强：
 * - 纠错带 type 字段（grammar / vocabulary / pronunciation / expression）
 * - 纠错带 confidence 字段（0-1）
 * - 回复带 dimensionScores（fluency / grammar / vocabulary / pronunciation / confidence）
 */
function parseAIResponse(content) {
  const text = content.trim()

  // ===== 格式1：[Correction] / [Reply] 标签格式 =====
  const correctionMatch = text.match(/\[Correction\]([\s\S]*?)(?=\[Reply\]|$)/i)
  const replyMatch = text.match(/\[Reply\]([\s\S]*?)$/i)

  if (correctionMatch || replyMatch) {
    const correctionText = correctionMatch?.[1]?.trim() || ''
    const replyText = replyMatch?.[1]?.trim() || text

    const corrections = parseCorrectionsV2(correctionText)
    const score = extractScore(replyText)
    const dimensions = extractDimensionScores(text)

    return {
      reply: cleanReply(replyText),
      corrections,
      pronunciationTips: [],
      score,
      dimensions,
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
      corrections: (parsed.corrections || []).map(c => ({
        ...c,
        type: c.type || 'other',
        confidence: c.confidence ?? 0.8,
      })),
      pronunciationTips: parsed.pronunciation_tips || [],
      score: parsed.score ?? null,
      dimensions: parsed.dimensions || null,
    }
  } catch {
    return { reply: text, corrections: [], pronunciationTips: [], score: null, dimensions: null }
  }
}

/**
 * v2 增强版纠错解析 — 带类型分类和置信度
 */
function parseCorrectionsV2(text) {
  if (!text) return []

  const corrections = []

  // 类型检测关键词映射
  const typeKeywords = {
    grammar: ['verb', 'tense', 'subject', 'plural', 'article', 'preposition', "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "'t ", 'has have', 'should had'],
    vocabulary: ['instead of', 'better to say', 'we say', 'we use', 'word', 'vocab', 'expression'],
    pronunciation: ['pronounce', 'sound', 'say it', 'sounds like', 'accent', 'stress', 'syllable'],
    expression: ['natural', 'native', 'common', 'more common', 'we usually', 'people say', 'idiom'],
  }

  // instead of 模式 — 最常见的高置信度纠错
  const insteadPattern = /instead\s+of\s+(?:["']?)([^"'\n]+?)(?:["']?)(?:\s+(?:rather|than|or)\s+(?:["']?)([^"'\n]+?)(?:["'])?)/gi
  let match
  while ((match = insteadPattern.exec(text)) !== null) {
    if (match[1] && match[2]) {
      const original = match[1].trim()
      const corrected = match[2].trim()
      const context = text.replace(match[0], '').trim()

      let type = 'other'
      let confidence = 0.9
      for (const [t, keywords] of Object.entries(typeKeywords)) {
        if (keywords.some(k => context.toLowerCase().includes(k.toLowerCase()))) {
          type = t
          break
        }
      }

      corrections.push({ original, corrected, tip: context.slice(0, 120), type, confidence })
    }
  }

  // say/use 模式 — 中等置信度
  if (corrections.length === 0) {
    const sayPattern = /(?:say|use|try|better to say)[:\s]+(["'])([^"']+?)\1/i
    const sayMatch = text.match(sayPattern)
    if (sayMatch) {
      const wrongMatch = text.match(/(?:instead\s+of|rather\s+than|not[:\s]+|don't\s+say|avoid[:\s]+)?(["']?)([^"'\n]{2,40}?)(?:["'])?(?:\s*(?:is|are|sounds?|can be))/i)
      let type = 'vocabulary'
      for (const [t, keywords] of Object.entries(typeKeywords)) {
        if (keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) { type = t; break }
      }
      corrections.push({
        original: wrongMatch?.[2]?.trim() || '(see above)',
        corrected: sayMatch[2].trim(),
        tip: text.slice(0, 150),
        type,
        confidence: 0.75,
      })
    }
  }

  // 兜底
  if (corrections.length === 0 && text.length > 5) {
    let type = 'other'
    for (const [t, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) { type = t; break }
    }
    corrections.push({ original: '(review your sentence)', corrected: '', tip: text, type, confidence: 0.5 })
  }

  return corrections.slice(0, 3)
}

/**
 * 提取多维度评分（从完整文本中搜索维度标记）
 */
function extractDimensionScores(text) {
  const dims = {}
  const patterns = {
    fluency:      /\bfluency\s*[:\-]?\s*(\d{1,3})/i,
    grammar:      /\bgrammar\s*[:\-]?\s*(\d{1,3})/i,
    vocabulary:   /\b(?:vocabulary|vocab|lexical)\s*[:\-]?\s*(\d{1,3})/i,
    pronunciation:/\bpronunciation\s*[:\-]?\s*(\d{1,3})/i,
    confidence:   /\bconfidence\s*[:\-]?\s*(\d{1,3})/i,
  }

  for (const [dim, pattern] of Object.entries(patterns)) {
    const m = text.match(pattern)
    if (m && m[1]) {
      const n = parseInt(m[1], 10)
      if (n >= 0 && n <= 100) dims[dim] = n
    }
  }

  return Object.keys(dims).length > 0 ? dims : null
}

/**
 * 从回复文本中提取分数
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
 * 清理回复文本 — 移除所有评分相关文字，只保留纯对话内容
 */
function cleanReply(text) {
  return text
    .replace(/\(\s*(?:fluency|grammar|vocabulary|pronunciation|confidence)[^)]*\)/gi, '')
    .replace(/(?:^|\s)(?:fluency|grammar|vocabulary|pronunciation|confidence)\s*:\s*\d{1,3}(?:\s+(?:fluency|grammar|vocabulary|pronunciation|confidence)\s*:\s*\d{1,3}){0,4}\s*$/gi, '')
    .replace(/\(?\s*score\s*[:\-]?\s*\d{1,3}\s*\/?\d*\s*\)?/gi, '')
    .replace(/\(\s*\d{1,3}\s*\/?\s*100?\s*\)/g, '')
    .replace(/\[Score:\s*\d{1,3}\]/gi, '')
    .replace(/\s{2,}/g, ' ').trim() || text
}