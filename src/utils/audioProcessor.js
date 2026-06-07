/**
 * 音频处理器 — Web Audio API 实时音频处理
 *
 * 功能：
 * 1. 噪声门（Noise Gate）— 低于阈值的信号直接静音，消除背景噪音
 * 2. 自动增益控制（AGC）— DynamicsCompressorNode 压缩动态范围
 * 3. 低通滤波 — 滤除高频噪声（10000Hz+）
 * 4. 实时电平监控 — 提供 RMS 电平数据供 UI 波形展示
 * 5. AudioContext 生命周期管理 — 自动恢复 suspended 状态
 *
 * 延迟目标：< 10ms 处理延迟（Web Audio API 原生处理，无 JS 主线程阻塞）
 */

let audioCtx = null
let processorNode = null
let analyserNode = null
let noiseGateNode = null
let compressorNode = null
let lowPassNode = null
let sourceNode = null
let streamRef = null

// 噪声门阈值（RMS 幅度，0-1）
const NOISE_GATE_THRESHOLD = 0.015

// 分析器配置
const ANALYSER_FFT = 256
const ANALYSER_SMOOTHING = 0.8

/**
 * 获取或创建共享 AudioContext（懒加载）
 */
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      // 低延迟优化：较小的 buffer size
      latencyHint: 'interactive',
    })
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * 初始化音频处理管线
 *
 * 管线：MediaStream → Source → NoiseGate → LowPass → Compressor → Analyser → Destination
 *
 * @param {MediaStream} stream - 麦克风媒体流
 * @param {function} onLevel - 实时电平回调 (rms: number, peak: number)
 * @returns {object} 处理节点引用
 */
export function initAudioPipeline(stream, onLevel) {
  try {
    const ctx = getAudioContext()
    streamRef = stream

    // 1. 创建媒体源
    sourceNode = ctx.createMediaStreamSource(stream)

    // 2. 噪声门（使用 ScriptProcessorNode 或 AudioWorkletNode）
    // 浏览器兼容：使用 ScriptProcessorNode（兼容性最好，延迟 ~2-5ms）
    const bufferSize = 256 // 小 buffer = 低延迟
    noiseGateNode = ctx.createScriptProcessor(bufferSize, 1, 1)
    noiseGateNode.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      const output = event.outputBuffer.getChannelData(0)

      // 计算 RMS
      let sumSquares = 0
      let peak = 0
      for (let i = 0; i < input.length; i++) {
        const sample = input[i]
        sumSquares += sample * sample
        const abs = Math.abs(sample)
        if (abs > peak) peak = abs
      }
      const rms = Math.sqrt(sumSquares / input.length)

      // 噪声门：低于阈值 → 静音
      if (rms < NOISE_GATE_THRESHOLD) {
        output.fill(0)
      } else {
        output.set(input)
      }

      // 回调电平数据
      if (onLevel) {
        onLevel(rms, peak)
      }
    }

    // 3. 低通滤波器（切除 10000Hz 以上高频噪声，保留语音频段）
    lowPassNode = ctx.createBiquadFilter()
    lowPassNode.type = 'lowpass'
    lowPassNode.frequency.value = 8000 // 人声最高约 8kHz
    lowPassNode.Q.value = 0.7

    // 4. 动态压缩器（自动增益控制）
    compressorNode = ctx.createDynamicsCompressor()
    compressorNode.threshold.value = -24 // 阈值：-24dB
    compressorNode.knee.value = 30      // 软拐点
    compressorNode.ratio.value = 12      // 压缩比
    compressorNode.attack.value = 0.003  // 3ms 快起
    compressorNode.release.value = 0.25  // 250ms 释放

    // 5. 分析器节点（不修改信号，只读取数据）
    analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = ANALYSER_FFT
    analyserNode.smoothingTimeConstant = ANALYSER_SMOOTHING
    analyserNode.minDecibels = -90
    analyserNode.maxDecibels = -10

    // 6. 连接管线
    // Source → NoiseGate → LowPass → Compressor → Analyser → Destination
    sourceNode.connect(noiseGateNode)
    noiseGateNode.connect(lowPassNode)
    lowPassNode.connect(compressorNode)
    compressorNode.connect(analyserNode)
    analyserNode.connect(ctx.destination)

    processorNode = noiseGateNode

    return {
      analyser: analyserNode,
      compressor: compressorNode,
      noiseGate: noiseGateNode,
      lowPass: lowPassNode,
      source: sourceNode,
    }
  } catch (e) {
    console.warn('[AudioProcessor] Pipeline init failed:', e)
    return null
  }
}

/**
 * 获取实时频域数据（用于波形可视化）
 * @returns {Uint8Array | null} 频域数据数组
 */
export function getFrequencyData() {
  if (!analyserNode) return null
  const data = new Uint8Array(analyserNode.frequencyBinCount)
  analyserNode.getByteFrequencyData(data)
  return data
}

/**
 * 获取实时时域数据
 * @returns {Uint8Array | null}
 */
export function getTimeDomainData() {
  if (!analyserNode) return null
  const data = new Uint8Array(analyserNode.frequencyBinCount)
  analyserNode.getByteTimeDomainData(data)
  return data
}

/**
 * 获取当前 RMS 电平
 * @returns {number} 0-1 之间的 RMS 值
 */
export function getCurrentLevel() {
  if (!analyserNode) return 0
  const data = new Uint8Array(analyserNode.frequencyBinCount)
  analyserNode.getByteTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / data.length)
}

/**
 * 销毁音频处理管线
 */
export function destroyAudioPipeline() {
  try {
    if (sourceNode) {
      sourceNode.disconnect()
      sourceNode = null
    }
    if (noiseGateNode) {
      noiseGateNode.disconnect()
      noiseGateNode = null
    }
    if (lowPassNode) {
      lowPassNode.disconnect()
      lowPassNode = null
    }
    if (compressorNode) {
      compressorNode.disconnect()
      compressorNode = null
    }
    if (analyserNode) {
      analyserNode.disconnect()
      analyserNode = null
    }
    processorNode = null
    streamRef = null
  } catch { /* 静默 */ }
}

/**
 * 关闭 AudioContext（释放资源）
 */
export function closeAudioContext() {
  destroyAudioPipeline()
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close()
    audioCtx = null
  }
}

/**
 * 获取 AudioContext 实例（供外部直接使用）
 */
export { getAudioContext }