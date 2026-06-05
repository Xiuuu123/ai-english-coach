import { useRef } from 'react'

/**
 * 浏览器 TTS（Text-to-Speech）语音合成 Hook
 * 使用 Web Speech Synthesis API，零成本即开即用
 *
 * 特性：
 * - 同一场景内使用固定音色（首次选中后缓存）
 * - 支持指定输出设备（扬声器）
 */
export function useTTS() {
  const utteranceRef = useRef(null)
  // 缓存选中的英文语音，确保同一次会话中声音一致
  const cachedVoiceRef = useRef(null)

  /**
   * 获取固定的英文语音（只选一次，之后复用）
   */
  function getEnglishVoice() {
    if (cachedVoiceRef.current) return cachedVoiceRef.current

    const voices = window.speechSynthesis.getVoices()

    // 优先级：美式女声 > 美式男声 > 任意英声
    const preferred = [
      // 常见的高质量美式女声
      voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English') && v.name.toLowerCase().includes('female')),
      voices.find(v => v.name.includes('Microsoft Zira')),
      voices.find(v => v.name.includes('Google US English')),
      voices.find(v => v.lang === 'en-US' && v.name.includes('Female')),
      // 美式男声
      voices.find(v => v.name.includes('Microsoft David')),
      voices.find(v => v.name.includes('Google US English')),
      // 兜底：任意英声
      voices.find(v => v.lang.startsWith('en-US')),
      voices.find(v => v.lang.startsWith('en')),
    ].find(Boolean)

    cachedVoiceRef.current = preferred
    return preferred
  }

  /**
   * 播放英文语音
   * @param {string} text - 要朗读的文本
   * @param {object} options - 配置选项
   * @param {string} options.outputDeviceId - 输出设备 ID（扬声器）
   */
  const speak = (text, options = {}) => {
    if (!window.speechSynthesis) return

    // 停止当前正在播放的语音
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = options.rate ?? 0.9
    utterance.pitch = options.pitch ?? 1.0
    utterance.volume = options.volume ?? 1.0

    // 使用缓存的固定语音，确保同一场景内声音一致
    const voice = getEnglishVoice()
    if (voice) {
      utterance.voice = voice
    }

    utteranceRef.current = utterance

    // 设置输出设备
    if (options.outputDeviceId && typeof AudioContext !== 'undefined') {
      try {
        const audioCtx = new AudioContext()
        const destination = audioCtx.createMediaStreamDestination()

        if (destination.stream && options.outputDeviceId) {
          const audioEl = document.createElement('audio')
          audioEl.srcObject = destination.stream
          audioEl.setSinkId?.(options.outputDeviceId).catch(() => {})
          audioEl.play().catch(() => {})
        }
      } catch {
        // setSinkId 不支持时静默降级
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  /**
   * 重置缓存的语音（切换场景时可选调用）
   */
  const resetVoice = () => {
    cachedVoiceRef.current = null
  }

  const stop = () => {
    window.speechSynthesis?.cancel()
  }

  return { speak, stop, resetVoice }
}