import { useState, useRef, useEffect } from 'react'

/**
 * 音频设备切换组件 v2
 *
 * 优化点：
 * - 设备 label 友好显示（带图标：耳机/麦克风/扬声器）
 * - 麦克风测试：实时显示音量条
 * - 错误状态可视化（红色提示 + 重试按钮）
 * - 刷新按钮：手动重新枚举
 * - 耳机检测提示：标注 "耳机" / "外置" / "内置"
 */
export default function DeviceSelector({
  microphones,
  speakers,
  selectedMicId,
  selectedSpeakerId,
  onMicChange,
  onSpeakerChange,
  isDeviceReady,
  error,
  permission,
  refreshDevices,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [testLevel, setTestLevel] = useState(0)
  const [isTesting, setIsTesting] = useState(false)
  const testStreamRef = useRef(null)
  const testAnimRef = useRef(null)
  const testAudioCtxRef = useRef(null)

  /**
   * 智能识别设备类型，返回友好名称 + 图标
   */
  function getDeviceInfo(device, index) {
    const label = (device.label || '').toLowerCase()
    let icon = '🎤'
    let typeLabel = '麦克风'

    if (label.includes('headset') || label.includes('耳') || label.includes('airpod')) {
      icon = '🎧'
      typeLabel = '耳机麦克风'
    } else if (label.includes('usb')) {
      icon = '🔌'
      typeLabel = '外置麦克风'
    } else if (label.includes('array') || label.includes('built') || label.includes('internal')) {
      icon = '💻'
      typeLabel = '内置麦克风'
    } else if (label.includes('virtual') || label.includes('vb-cable') || label.includes('cable')) {
      icon = '🔀'
      typeLabel = '虚拟音频'
    }

    return {
      icon,
      typeLabel,
      display: device.label || `${typeLabel} ${index + 1}`,
    }
  }

  function getSpeakerInfo(device, index) {
    const label = (device.label || '').toLowerCase()
    let icon = '🔈'
    let typeLabel = '扬声器'

    if (label.includes('headset') || label.includes('耳') || label.includes('airpod')) {
      icon = '🎧'
      typeLabel = '耳机'
    } else if (label.includes('speaker') || label.includes('扬声器')) {
      icon = '🔊'
      typeLabel = '扬声器'
    } else if (label.includes('display') || label.includes('hdmi')) {
      icon = '🖥️'
      typeLabel = '显示器音频'
    }

    return {
      icon,
      typeLabel,
      display: device.label || `${typeLabel} ${index + 1}`,
    }
  }

  function handleToggle() {
    const willOpen = !isOpen
    setIsOpen(willOpen)
    if (willOpen && !isDeviceReady) {
      refreshDevices()
    }
  }

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await refreshDevices()
    } finally {
      setIsRefreshing(false)
    }
  }

  /**
   * 麦克风测试：打开当前选中的麦克风，显示实时音量
   */
  async function handleMicTest() {
    if (isTesting) {
      // 停止测试
      stopMicTest()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
          echoCancellation: true,
          noiseSuppression: false,
        },
      })
      testStreamRef.current = stream

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioCtx()
      testAudioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        // 计算峰值
        let peak = 0
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128
          if (v > peak) peak = v
        }
        setTestLevel(peak)
        testAnimRef.current = requestAnimationFrame(tick)
      }
      tick()
      setIsTesting(true)
    } catch (e) {
      console.warn('[DeviceSelector] mic test failed:', e)
    }
  }

  function stopMicTest() {
    if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current)
    testAnimRef.current = null
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop())
      testStreamRef.current = null
    }
    if (testAudioCtxRef.current) {
      testAudioCtxRef.current.close().catch(() => {})
      testAudioCtxRef.current = null
    }
    setIsTesting(false)
    setTestLevel(0)
  }

  // 关闭弹窗时停止测试
  useEffect(() => {
    if (!isOpen) stopMicTest()
    return () => stopMicTest()
  }, [isOpen])

  // 卸载时清理
  useEffect(() => {
    return () => stopMicTest()
  }, [])

  return (
    <div className="relative">
      {/* 设备设置按钮 */}
      <button
        onClick={handleToggle}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white relative"
        title="音频设备设置"
        aria-label="音频设备设置"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.737-.527c-.35-.25-.807-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {permission === 'denied' && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 p-4 space-y-3 animate-slide-up">
            {/* 标题 + 刷新按钮 */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                🔊 音频设备
              </h3>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                title="重新检测设备"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isRefreshing ? '检测中' : '刷新'}
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-xs text-red-300 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <span>⚠️</span>
                  <div className="flex-1">
                    <p className="font-medium mb-0.5">设备异常</p>
                    <p className="text-red-300/80">{error}</p>
                    {permission === 'denied' && (
                      <p className="text-red-300/60 mt-1.5 text-[11px]">
                        💡 提示：点击地址栏左侧 🔒 图标 → 允许麦克风权限
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 加载中 */}
            {!isDeviceReady ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2.5">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                </div>
                <span className="text-sm text-slate-400">正在检测设备...</span>
                {permission === 'prompt' && (
                  <p className="text-[11px] text-amber-300/80 mt-1">
                    请在浏览器弹窗中允许使用麦克风
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* 麦克风选择 */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>🎤 输入设备（麦克风）</span>
                    <span className="text-[10px] text-slate-500">{microphones.length} 个</span>
                  </label>
                  {microphones.length > 0 ? (
                    <select
                      value={selectedMicId}
                      onChange={(e) => onMicChange(e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    >
                      {microphones.map((mic, i) => {
                        const info = getDeviceInfo(mic, i)
                        return (
                          <option key={mic.deviceId} value={mic.deviceId}>
                            {info.icon} {info.display}
                          </option>
                        )
                      })}
                    </select>
                  ) : (
                    <p className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 text-center">
                      未检测到麦克风设备<br />
                      <span className="text-[10px] text-red-400/60">请检查耳机/麦克风是否插好</span>
                    </p>
                  )}

                  {/* 麦克风测试 */}
                  {microphones.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={handleMicTest}
                        className={[
                          'text-[11px] px-2.5 py-1 rounded-md transition-colors flex items-center gap-1',
                          isTesting
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25',
                        ].join(' ')}
                      >
                        {isTesting ? '⏹ 停止' : '🎙 测试'}
                      </button>
                      {/* 音量条 */}
                      <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full transition-all duration-75"
                          style={{
                            width: `${Math.min(100, testLevel * 100 * 2)}%`,
                            background: testLevel > 0.5
                              ? 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)'
                              : 'linear-gradient(90deg, #4F8BFF, #10b981)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 扬声器选择 */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>🔈 输出设备（扬声器）</span>
                    <span className="text-[10px] text-slate-500">{speakers.length} 个</span>
                  </label>
                  {speakers.length > 0 ? (
                    <select
                      value={selectedSpeakerId}
                      onChange={(e) => onSpeakerChange(e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    >
                      {speakers.map((spk, i) => {
                        const info = getSpeakerInfo(spk, i)
                        return (
                          <option key={spk.deviceId || 'default'} value={spk.deviceId || 'default'}>
                            {info.icon} {info.display}
                          </option>
                        )
                      })}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-700/30 rounded-lg px-3 py-2 text-center">使用系统默认输出</p>
                  )}
                </div>

                {/* 提示 */}
                <div className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-white/5">
                  💡 提示：
                  <ul className="mt-1 space-y-0.5 ml-3">
                    <li>• 插拔耳机后会自动刷新</li>
                    <li>• 耳机听不到声音时，切换输出设备</li>
                    <li>• 麦克风测试可验证耳机收音</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
