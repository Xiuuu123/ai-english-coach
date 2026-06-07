import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 音频设备管理 Hook v2
 *
 * 核心优化：
 * 1. 提前请求权限：获得授权后设备 label 才可见（解决耳机检测不到）
 * 2. 设备变化自动重连：热插拔耳机后 200ms 内自动刷新
 * 3. 重试机制：初次 getUserMedia 失败时最多重试 3 次
 * 4. 持久化选择：localStorage 保存用户上次选中的设备
 * 5. 指定首选设备约束：getUserMedia 传入 deviceId 而非依赖默认
 * 6. 错误状态暴露：UI 可提示用户"请检查耳机是否插好"
 */
export function useAudioDevices() {
  const [microphones, setMicrophones] = useState([])
  const [speakers, setSpeakers] = useState([])
  const [selectedMicId, setSelectedMicId] = useState(() => {
    try { return localStorage.getItem('ai-coach-mic-id') || '' } catch { return '' }
  })
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(() => {
    try { return localStorage.getItem('ai-coach-speaker-id') || 'default' } catch { return 'default' }
  })
  const [isDeviceReady, setIsDeviceReady] = useState(false)
  const [error, setError] = useState(null)
  const [permission, setPermission] = useState('unknown') // 'granted' | 'denied' | 'prompt' | 'unknown'
  const hasEnumerated = useRef(false)
  const streamRef = useRef(null)
  const retryCountRef = useRef(0)
  const MAX_RETRY = 3

  /**
   * 释放当前的麦克风流
   */
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  /**
   * 枚举设备（带重试 + 优化约束）
   *
   * 关键点：
   * 1. 调用 getUserMedia 一次，让浏览器填充设备 label
   * 2. 立即 stop 所有轨道（不占用麦克风）
   * 3. 解析 audioinput/audiooutput 列表
   * 4. 持久化用户偏好
   */
  const refreshDevices = useCallback(async (force = false) => {
    if (hasEnumerated.current && !force) return

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持音频设备 API')
      return
    }

    try {
      setError(null)
      releaseStream()

      // 1. 请求权限（关键步骤 — 不请求则 device.label 为空字符串）
      // 第一次先不指定 deviceId，让浏览器选择默认麦克风（更快成功）
      const constraints = {
        audio: selectedMicId
          ? { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setPermission('granted')

      // 2. 枚举所有设备（此时 label 已经有值）
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter(d => d.kind === 'audioinput')
      const outs = devices.filter(d => d.kind === 'audiooutput')

      setMicrophones(mics)
      setSpeakers(outs)

      // 3. 默认设备选择 — 优先使用上次的偏好，其次第一个
      if (mics.length > 0) {
        const preferred = mics.find(d => d.deviceId === selectedMicId)
        if (!preferred) {
          setSelectedMicId(mics[0].deviceId)
          try { localStorage.setItem('ai-coach-mic-id', mics[0].deviceId) } catch {}
        }
      }
      if (outs.length > 0 && selectedSpeakerId !== 'default') {
        const preferred = outs.find(d => d.deviceId === selectedSpeakerId)
        if (!preferred) {
          setSelectedSpeakerId(outs[0].deviceId || 'default')
          try { localStorage.setItem('ai-coach-speaker-id', outs[0].deviceId || 'default') } catch {}
        }
      }

      setIsDeviceReady(true)
      hasEnumerated.current = true
      retryCountRef.current = 0

      // 4. 立即释放麦克风流 — 不让 Web Audio / Speech API 冲突
      setTimeout(releaseStream, 200)
    } catch (err) {
      console.warn('[AudioDevices] enumerate failed:', err.name, err.message)

      // 区分错误类型
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问')
        setPermission('denied')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('未检测到麦克风设备，请检查耳机/麦克风是否连接')
        setPermission('denied')
      } else if (err.name === 'OverconstrainedError') {
        // 选中的设备不可用 — 自动回退到默认设备
        console.warn('[AudioDevices] Selected device unavailable, fallback...')
        if (selectedMicId) {
          setSelectedMicId('')
          try { localStorage.removeItem('ai-coach-mic-id') } catch {}
        }
        // 重试
        if (retryCountRef.current < MAX_RETRY) {
          retryCountRef.current++
          setTimeout(() => refreshDevices(true), 300)
        }
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('麦克风被其他程序占用，请关闭录音/会议软件后重试')
      } else {
        // 未知错误 — 自动重试
        if (retryCountRef.current < MAX_RETRY) {
          retryCountRef.current++
          setTimeout(() => refreshDevices(true), 500)
        } else {
          setError(`设备初始化失败: ${err.message || err.name}`)
        }
      }
    }
  }, [selectedMicId, selectedSpeakerId, releaseStream])

  /**
   * 用户主动切换麦克风
   */
  const updateSelectedMic = useCallback((deviceId) => {
    setSelectedMicId(deviceId)
    try { localStorage.setItem('ai-coach-mic-id', deviceId) } catch {}
  }, [])

  /**
   * 用户主动切换扬声器
   */
  const updateSelectedSpeaker = useCallback((deviceId) => {
    setSelectedSpeakerId(deviceId)
    try { localStorage.setItem('ai-coach-speaker-id', deviceId) } catch {}
  }, [])

  // 监听设备热插拔 — 立即刷新
  useEffect(() => {
    if (!navigator.mediaDevices) return
    let debounceTimer = null
    const handler = () => {
      // 防抖 200ms — 多次设备事件合并
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (hasEnumerated.current) {
          hasEnumerated.current = false
          refreshDevices(true)
        }
      }, 200)
    }
    navigator.mediaDevices.addEventListener('devicechange', handler)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handler)
      clearTimeout(debounceTimer)
    }
  }, [refreshDevices])

  // 卸载时清理
  useEffect(() => {
    return () => releaseStream()
  }, [releaseStream])

  return {
    microphones,
    speakers,
    selectedMicId,
    selectedSpeakerId,
    setSelectedMicId: updateSelectedMic,
    setSelectedSpeakerId: updateSelectedSpeaker,
    isDeviceReady,
    error,
    permission,
    refreshDevices,
  }
}
