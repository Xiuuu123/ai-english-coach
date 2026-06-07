import { useState } from 'react'

/**
 * 音频设备切换组件（深色主题版）
 * 支持选择麦克风（输入）和扬声器（输出）设备
 * 懒加载：点击按钮时才请求设备权限和枚举设备列表
 */
export default function DeviceSelector({
  microphones,
  speakers,
  selectedMicId,
  selectedSpeakerId,
  onMicChange,
  onSpeakerChange,
  isDeviceReady,
  refreshDevices,
}) {
  const [isOpen, setIsOpen] = useState(false)

  function handleToggle() {
    if (!isOpen && !isDeviceReady) {
      refreshDevices()
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative">
      {/* 设备设置按钮 */}
      <button
        onClick={handleToggle}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
        title="音频设备设置"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.737-.527c-.35-.25-.807-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 p-4 space-y-4 animate-slide-up">
            <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
              🔊 音频设备
            </h3>

            {!isDeviceReady ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                <span className="text-sm text-slate-400 ml-2">正在获取设备...</span>
              </div>
            ) : (
              <>
                {/* 麦克风选择 */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                    🎤 输入设备（麦克风）
                  </label>
                  {microphones.length > 0 ? (
                    <select
                      value={selectedMicId}
                      onChange={(e) => onMicChange(e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer appearance-none"
                    >
                      {microphones.map((mic) => (
                        <option key={mic.deviceId} value={mic.deviceId}>
                          {mic.label || `麦克风 ${microphones.indexOf(mic) + 1}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-red-400/70 bg-red-500/5 rounded-lg px-3 py-2 text-center">未检测到麦克风</p>
                  )}
                </div>

                {/* 扬声器选择 */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                    🔈 输出设备（扬声器）
                  </label>
                  {speakers.length > 0 ? (
                    <select
                      value={selectedSpeakerId}
                      onChange={(e) => onSpeakerChange(e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer appearance-none"
                    >
                      {speakers.map((spk) => (
                        <option key={spk.deviceId} value={spk.deviceId}>
                          {spk.label || `扬声器 ${speakers.indexOf(spk) + 1}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-700/30 rounded-lg px-3 py-2 text-center">使用默认输出</p>
                  )}
                </div>

                {/* 提示 */}
                <p className="text-[11px] text-slate-500 leading-tight pt-1">
                  插拔耳机或麦克风后自动刷新列表
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}