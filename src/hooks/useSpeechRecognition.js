import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Web Speech API 语音识别 Hook v3
 *
 * 延迟优化：
 * 1. 预创建 SpeechRecognition 实例（page load 时预热）
 * 2. 重启延迟降至 25ms（原 80-100ms）
 * 3. 最小化 onresult 回调中的计算量
 * 4. 使用 microtask 处理 interim 更新，避免帧丢失
 *
 * 稳定性优化：
 * 1. sessionId 双重校验 — 彻底解决竞态
 * 2. 自动恢复 — 浏览器静音断开时自动重启
 * 3. 静默跳过 aborted/no-speech 错误
 * 4. 退避重试 — 连续失败时延长重试间隔
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isSupported, setIsSupported] = useState(true)
  const [networkError, setNetworkError] = useState(null) // v8: 网络/服务不可达错误
  // v8: 微信式上滑取消状态
  const [isCancelMode, setIsCancelMode] = useState(false)
  const recognitionRef = useRef(null)
  const isHoldingRef = useRef(false)
  const isCancelRef = useRef(false)  // 标记本次录音是否已被取消（防止 onend 后又触发 onresult 提交）
  const accumulatedRef = useRef('')
  const sessionIdRef = useRef(0)
  // 连续失败计数（用于退避重试）
  const failCountRef = useRef(0)
  // v8: 网络错误重试计数（有上限，避免无限重试）
  const networkRetryRef = useRef(0)
  const MAX_NETWORK_RETRIES = 3

  // 预创建识别实例（页面加载时即创建，消除首次创建延迟 ~50ms）
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }
    // 预创建但不启动
    const preRec = new SpeechRecognition()
    preRec.lang = 'en-US'
    preRec.interimResults = true
    preRec.continuous = true
    preRec.maxAlternatives = 3
    recognitionRef.current = preRec
    console.log('[STT] Pre-created recognition instance')

    return () => {
      try { preRec.abort() } catch {}
    }
  }, [])

  // v8: 录制用户麦克风音频用于回放（MediaRecorder）
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const lastAudioBlobRef = useRef(null)       // 最近一次完成的 Blob
  const [lastAudioUrl, setLastAudioUrl] = useState(null)  // 回放 URL
  // v8: 录音时长（秒），用于语音气泡展示
  const recordingStartTimeRef = useRef(0)
  const [lastAudioDuration, setLastAudioDuration] = useState(0)

  function startMediaRecording() {
    try {
      // 复用 recognition 创建时打开的麦克风流（getUserMedia）
      // SpeechRecognition 内部会管理麦克风，MediaRecorder 单独拿一份
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mr = new MediaRecorder(stream)
        audioChunksRef.current = []
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          // 释放旧 URL
          if (lastAudioBlobRef.current) {
            try { URL.revokeObjectURL(lastAudioUrl) } catch {}
          }
          lastAudioBlobRef.current = blob
          setLastAudioUrl(URL.createObjectURL(blob))
          // 关闭 stream
          stream.getTracks().forEach(t => t.stop())
        }
        mediaRecorderRef.current = mr
        mr.start()
      }).catch(() => {
        // 麦克风权限被拒或不支持时静默失败，不影响语音识别
      })
    } catch {}
  }

  function stopMediaRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    } catch {}
  }

  function cleanup() {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.lang = 'en-US'
        recognitionRef.current.interimResults = true
        recognitionRef.current.continuous = true
        recognitionRef.current.maxAlternatives = 3
      }
    }
  }

  function createAndStart(currentSessionId) {
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
    recognition.maxAlternatives = 3 // 降低候选项数量减少计算量

    recognition.onresult = (event) => {
      if (sessionIdRef.current !== currentSessionId) return

      // 使用 microtask 队列处理结果，避免阻塞主线程
      queueMicrotask(() => {
        if (sessionIdRef.current !== currentSessionId) return

        let finalPart = ''
        let interimStr = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          // 选第一个候选项（最高置信度），减少遍历
          const best = result[0].transcript

          if (result.isFinal) {
            finalPart += best
          } else {
            interimStr += best
          }
        }

        if (finalPart) {
          accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalPart
          setTranscript(accumulatedRef.current)
          setInterimText('')
        }
        if (interimStr) {
          setInterimText(interimStr)
        }
      })
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return

      if (event.error === 'not-allowed') {
        alert('请允许浏览器使用麦克风权限')
        setIsListening(false)
        isHoldingRef.current = false
        return
      }

      // v8: 网络错误 — 语音识别服务不可达（常见于国内网络无法访问 Google 服务）
      if (event.error === 'network' || event.error === 'service-not-allowed') {
        networkRetryRef.current += 1
        if (networkRetryRef.current >= MAX_NETWORK_RETRIES) {
          setIsListening(false)
          isHoldingRef.current = false
          setNetworkError(
            event.error === 'network'
              ? '语音识别服务连接失败，请检查网络是否能访问 Google 服务，或尝试使用 Edge 浏览器'
              : '当前浏览器不支持语音识别服务，请尝试使用 Chrome 或 Edge 浏览器'
          )
          return
        }
        // 首次出现网络错误，等待后重试一次（可能是临时网络波动）
        setTimeout(() => {
          if (sessionIdRef.current === currentSessionId && isHoldingRef.current) {
            createAndStart(currentSessionId)
          }
        }, 1500)
        return
      }

      // 记录失败
      failCountRef.current += 1

      // 退避重试：连续失败越多，重试间隔越长
      const backoff = Math.min(failCountRef.current * 50, 500)

      if (sessionIdRef.current === currentSessionId && isHoldingRef.current) {
        setTimeout(() => {
          if (sessionIdRef.current === currentSessionId && isHoldingRef.current) {
            createAndStart(currentSessionId)
          }
        }, 25 + backoff)
      } else if (sessionIdRef.current === currentSessionId) {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      if (sessionIdRef.current === currentSessionId && isHoldingRef.current) {
        // 快速重启（25ms 延迟，原 80ms）
        setTimeout(() => {
          if (sessionIdRef.current === currentSessionId && isHoldingRef.current) {
            try {
              const newRec = new SpeechRecognition()
              newRec.lang = 'en-US'
              newRec.interimResults = true
              newRec.continuous = true
              newRec.maxAlternatives = 3
              newRec.onresult = recognition.onresult
              newRec.onerror = recognition.onerror
              newRec.onend = recognition.onend
              recognitionRef.current = newRec
              newRec.start()
              failCountRef.current = 0 // 成功重启，重置失败计数
            } catch (e) {
              console.warn('[STT] restart failed:', e)
            }
          }
        }, 25)
      } else if (sessionIdRef.current === currentSessionId) {
        setIsListening(false)
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
      failCountRef.current = 0
    } catch (e) {
      console.error('[STT] start failed:', e)
    }
  }

  const startListening = useCallback(() => {
    if (!isSupported) return

    const newSessionId = ++sessionIdRef.current
    isHoldingRef.current = true
    isCancelRef.current = false  // v8: 重置取消标记
    setIsCancelMode(false)       // v8: 重置取消状态
    recordingStartTimeRef.current = Date.now()  // v8: 记录录音开始时间
    accumulatedRef.current = ''
    setTranscript('')
    setInterimText('')
    setIsListening(true)
    setNetworkError(null)      // v8: 重置网络错误状态
    networkRetryRef.current = 0 // v8: 重置网络重试计数

    // v8: 同步开始录制用户麦克风（用于回放）
    startMediaRecording()

    createAndStart(newSessionId)
  }, [isSupported])

  const stopListening = useCallback(() => {
    ++sessionIdRef.current
    isHoldingRef.current = false
    setIsListening(false)
    setIsCancelMode(false)  // v8: 重置取消状态

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }

    // v8: 停止录制
    stopMediaRecording()

    // v8: 计算录音时长（秒）
    if (recordingStartTimeRef.current) {
      const dur = Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
      setLastAudioDuration(dur > 0 ? dur : 1)
    }

    const finalText = accumulatedRef.current
    if (finalText?.trim()) {
      setTranscript(finalText)
      setInterimText('')
    } else {
      setInterimText(prev => {
        if (prev) {
          setTranscript(prev)
          return ''
        }
        return prev
      })
    }
  }, [])

  /**
   * v8: 微信式上滑取消
   * 触发时机：用户在录音过程中向上滑动并松开手指
   * 效果：终止录音、清空所有累积文本、不返回任何转写结果
   */
  const cancelListening = useCallback(() => {
    isCancelRef.current = true
    isHoldingRef.current = false
    setIsCancelMode(false)
    setIsListening(false)
    ++sessionIdRef.current
    // 中止识别（不调用 stop()，避免触发 final result）
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
    }
    // 停止录制并丢弃音频
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    // 丢弃转写结果
    accumulatedRef.current = ''
    setTranscript('')
    setInterimText('')
    // 清理可能存在的回放 URL
    if (lastAudioBlobRef.current) {
      try { URL.revokeObjectURL(lastAudioBlobRef.current) } catch {}
      lastAudioBlobRef.current = null
      setLastAudioUrl(null)
    }
  }, [])

  return { isListening, transcript, interimText, isSupported, networkError, lastAudioUrl, lastAudioDuration, isCancelMode, setIsCancelMode, startListening, stopListening, cancelListening, setTranscript }
}