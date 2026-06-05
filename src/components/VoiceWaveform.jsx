import { useRef, useEffect } from 'react'

/**
 * 语音波形可视化组件
 * 录音时显示实时音量波形，让用户直观看到自己在说话
 *
 * 使用 Web Audio API 的 AnalyserNode 获取音量数据
 * 用 Canvas 绘制波形
 */
export default function VoiceWaveform({ isActive, color = '#ef4444' }) {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    if (!isActive) {
      // 停止时画一条平线
      drawIdle()
      return
    }

    initAudioAndDraw()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isActive])

  async function initAudioAndDraw() {
    try {
      // 获取麦克风流（用于音量分析）
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtxRef.current = new AudioContext()
      const source = audioCtxRef.current.createMediaStreamSource(stream)

      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      draw()
    } catch {
      // 权限被拒绝时用模拟波形
      simulateDraw()
    }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !analyserRef.current) return

    const ctx = canvas.getContext('2d')
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function render() {
      if (!isActive) return

      animFrameRef.current = requestAnimationFrame(render)
      analyserRef.current.getByteFrequencyData(dataArray)

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      const barCount = 32
      const barWidth = Math.max(1, (width / barCount) - 2)
      const step = Math.floor(bufferLength / barCount)

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255
        const barHeight = Math.max(3, value * height * 0.85)

        const x = i * (barWidth + 2) + 1
        const y = (height - barHeight) / 2

        // 渐变色：底部亮、顶部暗
        const gradient = ctx.createLinearGradient(x, y + barHeight, x, y)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, color + '60')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }
    }

    render()
  }

  /** 模拟波形（当无法获取麦克风权限时） */
  function simulateDraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let phase = 0

    function render() {
      if (!isActive) return
      animFrameRef.current = requestAnimationFrame(render)

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      const barCount = 32
      const barWidth = Math.max(1, (width / barCount) - 2)

      for (let i = 0; i < barCount; i++) {
        // 模拟正弦波 + 随机噪声
        const noise = 0.3 + 0.7 * Math.random()
        const wave = Math.sin(phase + i * 0.4) * 0.5 + 0.5
        const value = wave * noise
        const barHeight = Math.max(3, value * height * 0.8)

        const x = i * (barWidth + 2) + 1
        const y = (height - barHeight) / 2

        const gradient = ctx.createLinearGradient(x, y + barHeight, x, y)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, color + '50')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }

      phase += 0.15
    }

    render()
  }

  /** 空闲状态：画一条细线 */
  function drawIdle() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // 画一条中心线
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    // 画几个小点表示待命
    for (let i = 0; i < 32; i++) {
      const x = i * (width / 32) + width / 64
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.arc(x, height / 2, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return (
    <div className="w-full flex justify-center py-2">
      <canvas
        ref={canvasRef}
        width={280}
        height={48}
        className="rounded-lg"
        style={{ maxWidth: '100%', opacity: isActive ? 1 : 0.6 }}
      />
    </div>
  )
}