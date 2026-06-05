import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 音频设备管理 Hook
 * 懒加载：只在用户点击设备设置时才请求麦克风权限
 * 避免与 Web Speech API 争夺麦克风资源
 */
export function useAudioDevices() {
  const [microphones, setMicrophones] = useState([])
  const [speakers, setSpeakers] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('')
  const [isDeviceReady, setIsDeviceReady] = useState(false)
  const hasEnumerated = useRef(false)
  const streamRef = useRef(null)

  // 枚举所有音频设备（懒加载，只执行一次）
  const refreshDevices = useCallback(async () => {
    // 已枚举过且非强制刷新则跳过
    try {
      // 先释放之前的流（如果有）
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      // 需要先请求一次权限才能获取设备标签
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const devices = await navigator.mediaDevices.enumerateDevices()

      const mics = devices.filter(d => d.kind === 'audioinput')
      const outs = devices.filter(d => d.kind === 'audiooutput')

      setMicrophones(mics)
      setSpeakers(outs)

      // 默认选中第一个设备
      if (mics.length > 0 && !selectedMicId) {
        setSelectedMicId(mics[0].deviceId)
      }
      if (outs.length > 0 && !selectedSpeakerId) {
        setSelectedSpeakerId(outs[0].deviceId)
      }

      setIsDeviceReady(true)
      hasEnumerated.current = true

      // 获取完设备信息后立即释放麦克风流
      setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
      }, 500)
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
    }
  }, [selectedMicId, selectedSpeakerId])

  // 只监听设备变化，不在挂载时自动请求麦克风
  useEffect(() => {
    const handler = () => {
      if (hasEnumerated.current) refreshDevices()
    }
    navigator.mediaDevices?.addEventListener('devicechange', handler)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handler)
      // 清理残留流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [refreshDevices])

  return {
    microphones,
    speakers,
    selectedMicId,
    selectedSpeakerId,
    setSelectedMicId,
    setSelectedSpeakerId,
    isDeviceReady,
    refreshDevices,
  }
}