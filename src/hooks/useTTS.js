import { useRef, useEffect, useCallback } from 'react'

/**
 * 浏览器 TTS（Text-to-Speech）语音合成 Hook v4
 *
 * 延迟优化：
 * 1. 引擎预热 — 页面加载时发送无声 utterance 激活 speechSynthesis 引擎
 * 2. 预选音色 — 页面加载时即预加载语音列表并缓存最佳音色
 * 3. 零延迟打断 — stop() 立即取消当前播放，新 speak() 无需等待清理
 * 4. 分句播放 — 长文本按句子切分，逐句播放提升打断响应速度
 *
 * 流畅度优化：
 * 1. 智能打断 — 新消息到达时立即取消当前播放（非排队等待）
 * 2. 引擎保活 — 定时 ping speechSynthesis 防止 Chrome 引擎挂起
 * 3. 队列清理 — 取消时清空所有待播放队列
 *
 * 音频质量优化：
 * 1. 语速 0.92x — 自然口语节奏
 * 2. 音高 1.0 — 自然音高
 * 3. 自动选择最佳英文语音
 */
export function useTTS() {
  const utteranceRef = useRef(null)
  const cachedVoiceRef = useRef(null)
  const voicesLoadedRef = useRef(false)
  const isPlayingRef = useRef(false)
  // Chrome speechSynthesis 保活定时器
  const keepAliveRef = useRef(null)
  // 分句队列（用于长文本逐句播放）
  const sentenceQueueRef = useRef([])
  const sentenceIdxRef = useRef(0)
  // 当前播放的 utterance 引用（用于打断）
  const currentUtteranceRef = useRef(null)

  // v8: 当前口音（'us' | 'uk'）— 用于语音选择
  const accentRef = useRef('us')

  /**
   * 设置口音（供外部调用）
   * @param {'us'|'uk'} accent
   */
  const setAccent = useCallback((accent) => {
    accentRef.current = accent
    // 重新选择匹配的语音
    if (window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        cachedVoiceRef.current = selectBestEnglishVoice(voices, accent)
        console.log(`[TTS] Accent changed to ${accent}, voice:`, cachedVoiceRef.current?.name)
      }
    }
  }, [])

  // 页面加载后立即预加载语音列表 + 引擎预热
  useEffect(() => {
    if (!window.speechSynthesis) return

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        cachedVoiceRef.current = selectBestEnglishVoice(voices, accentRef.current)
        voicesLoadedRef.current = true
        console.log('[TTS] Voices preloaded:', cachedVoiceRef.current?.name)
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    // 引擎预热：发送无声 utterance 激活 speechSynthesis
    const warmUtterance = new SpeechSynthesisUtterance('')
    warmUtterance.volume = 0
    warmUtterance.rate = 1
    try {
      window.speechSynthesis.speak(warmUtterance)
    } catch { /* ignore */ }

    // Chrome bug 修复：定时 ping speechSynthesis 防止引擎挂起
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis && !window.speechSynthesis.speaking && !isPlayingRef.current) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 5000)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    }
  }, [])

  /**
   * 选择最佳英文语音（按口音优先级匹配）
   * @param {SpeechSynthesisVoice[]} voices
   * @param {'us'|'uk'} accent - 'us' 美式 (en-US) / 'uk' 英式 (en-GB)
   */
  function selectBestEnglishVoice(voices, accent = 'us') {
    const langPrefix = accent === 'uk' ? 'en-GB' : 'en-US'

    // 优选列表（按口音分别给出）
    const priority = accent === 'uk'
      ? [
          'Google UK English Female', 'Google UK English Male',
          'Microsoft George', 'Microsoft Hazel', 'Daniel', 'Karen',
        ]
      : [
          'Samantha', 'Google US English', 'Microsoft Zira',
          'Microsoft David', 'Microsoft Mark', 'Alex',
        ]

    for (const name of priority) {
      const found = voices.find(v => v.name.includes(name))
      if (found) return found
    }

    // 优选列表没有就按 lang 前缀匹配
    const sameLang = voices.find(v => v.lang === langPrefix)
    if (sameLang) return sameLang

    const langFamily = voices.find(v => v.lang.startsWith(langPrefix))
    if (langFamily) return langFamily

    // 兜底：任何英文语音
    return voices.find(v => v.lang.startsWith('en'))
  }

  /**
   * 将文本按句子切分（用于分句播放）
   */
  function splitSentences(text) {
    if (!text) return []
    // 按句号、问号、感叹号切分，保留分隔符
    const sentences = text.match(/[^.!?]+[.!?]+/g)
    if (!sentences || sentences.length === 0) return [text]
    return sentences
  }

  /**
   * 播放下一句（分句播放模式）
   */
  function playNextSentence(options) {
    const idx = sentenceIdxRef.current
    const queue = sentenceQueueRef.current

    if (idx >= queue.length) {
      isPlayingRef.current = false
      return
    }

    const text = queue[idx].trim()
    if (!text) {
      sentenceIdxRef.current++
      playNextSentence(options)
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = accentRef.current === 'uk' ? 'en-GB' : 'en-US'
    utterance.rate = options.rate ?? 0.92
    utterance.pitch = options.pitch ?? 1.0
    utterance.volume = options.volume ?? 1.0

    if (cachedVoiceRef.current) {
      utterance.voice = cachedVoiceRef.current
    }

    currentUtteranceRef.current = utterance

    utterance.onend = () => {
      sentenceIdxRef.current++
      // 句子间加 50ms 微停顿（模拟自然停顿，同时允许打断）
      setTimeout(() => playNextSentence(options), 50)
    }

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        isPlayingRef.current = false
        return
      }
      // 其他错误跳过当前句，继续下一句
      sentenceIdxRef.current++
      playNextSentence(options)
    }

    window.speechSynthesis.speak(utterance)
  }

  /**
   * 播放语音（v4：智能打断 + 分句播放）
   * @param {string} text - 要朗读的文本
   * @param {object} options - 配置 { rate, pitch, volume, outputDeviceId }
   */
  const speak = useCallback((text, options = {}) => {
    if (!window.speechSynthesis || !text?.trim()) return

    const trimmed = text.trim()

    // 立即停止当前播放（零延迟打断）
    window.speechSynthesis.cancel()
    isPlayingRef.current = false
    sentenceQueueRef.current = []
    sentenceIdxRef.current = 0
    currentUtteranceRef.current = null

    // 判断是否需要分句播放（> 120 字符的长文本分句，提升打断响应速度）
    if (trimmed.length > 120) {
      const sentences = splitSentences(trimmed)
      if (sentences.length > 1) {
        sentenceQueueRef.current = sentences
        sentenceIdxRef.current = 0
        isPlayingRef.current = true
        playNextSentence(options)
        return
      }
    }

    // 短文本直接播放
    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = accentRef.current === 'uk' ? 'en-GB' : 'en-US'
    utterance.rate = options.rate ?? 0.92
    utterance.pitch = options.pitch ?? 1.0
    utterance.volume = options.volume ?? 1.0

    if (cachedVoiceRef.current) {
      utterance.voice = cachedVoiceRef.current
    }

    currentUtteranceRef.current = utterance
    isPlayingRef.current = true

    utterance.onend = () => {
      isPlayingRef.current = false
      currentUtteranceRef.current = null
    }

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        isPlayingRef.current = false
        currentUtteranceRef.current = null
        return
      }
      isPlayingRef.current = false
      currentUtteranceRef.current = null
      console.warn('[TTS] Speak error:', e.error)
    }

    window.speechSynthesis.speak(utterance)
  }, [])

  /**
   * 停止播放（立即取消 + 清空分句队列）
   */
  const stop = useCallback(() => {
    sentenceQueueRef.current = []
    sentenceIdxRef.current = 0
    isPlayingRef.current = false
    currentUtteranceRef.current = null
    window.speechSynthesis?.cancel()
  }, [])

  /**
   * 重置缓存的语音
   */
  const resetVoice = useCallback(() => {
    cachedVoiceRef.current = null
  }, [])

  /** 是否已加载完成语音 */
  const isReady = useCallback(() => {
    return voicesLoadedRef.current && !!cachedVoiceRef.current
  }, [])

  return { speak, stop, resetVoice, isReady, setAccent }
}