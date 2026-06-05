import { useState, useCallback, useRef } from 'react'

/**
 * Web Speech API 语音识别 Hook
 * 按住说话期间，即使浏览器因静音断开也会自动重连
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef(null)
  // 标记用户是否还在按住（还没松手）
  const isHoldingRef = useRef(false)
  // 累积的最终文本（跨多次 onend 重启保持）
  const accumulatedRef = useRef('')

  function cleanup() {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
  }

  function createAndStart() {
    cleanup()

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalPart = ''
      let interimStr = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalPart += result[0].transcript
        } else {
          interimStr += result[0].transcript
        }
      }

      // 有新的最终结果，累积起来
      if (finalPart) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalPart
        setTranscript(accumulatedRef.current)
        setInterimText('')
      }
      // 中间结果叠加在累积文本后显示
      if (interimStr) {
        setInterimText(interimStr)
      }
    }

    recognition.onerror = (event) => {
      console.error('[STT] error:', event.error)

      if (event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        alert('请允许浏览器使用麦克风权限')
        setIsListening(false)
        isHoldingRef.current = false
        return
      }

      // 其他错误：如果用户还按着，尝试重启
      if (isHoldingRef.current) {
        setTimeout(() => createAndStart(), 100)
      } else {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      console.log('[STT] onend fired, still holding:', isHoldingRef.current)

      // 关键：如果用户还在按住，自动重启识别（解决静音断开的问题）
      if (isHoldingRef.current) {
        setTimeout(() => {
          if (isHoldingRef.current) {
            console.log('[STT] auto-restarting...')
            try {
              const newRec = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
              newRec.lang = 'en-US'
              newRec.interimResults = true
              newRec.continuous = true

              newRec.onresult = recognition.onresult
              newRec.onerror = recognition.onerror
              newRec.onend = recognition.onend

              recognitionRef.current = newRec
              newRec.start()
            } catch (e) {
              console.warn('[STT] restart failed:', e)
            }
          }
        }, 50)
      } else {
        // 用户松手了，正式结束
        setIsListening(false)
        // 把中间结果回退为最终结果
        setInterimText(prev => {
          if (prev && !accumulatedRef.current) {
            accumulatedRef.current = prev
            setTranscript(prev)
            return ''
          }
          return prev
        })
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (e) {
      console.error('[STT] start failed:', e)
    }
  }

  const startListening = useCallback(() => {
    if (!isSupported) return

    console.log('[STT] startListening - 用户按下')

    // 重置状态
    isHoldingRef.current = true
    accumulatedRef.current = ''
    setTranscript('')
    setInterimText('')
    setIsListening(true)

    createAndStart()
  }, [isSupported])

  const stopListening = useCallback(() => {
    console.log('[STT] stopListening - 用户松开, accumulated:', accumulatedRef.current)

    // 标记用户已松手
    isHoldingRef.current = false
    setIsListening(false)

    // 停止识别
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }

    // 用累积的最终文本作为结果
    const finalText = accumulatedRef.current
    if (finalText?.trim()) {
      setTranscript(finalText)
      setInterimText('')
    } else {
      // 回退到中间结果
      setInterimText(prev => {
        if (prev) {
          setTranscript(prev)
          return ''
        }
        return prev
      })
    }
  }, [])

  return { isListening, transcript, interimText, isSupported, startListening, stopListening, setTranscript }
}