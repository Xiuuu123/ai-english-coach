import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * 全局 Toast 通知系统
 *
 * 用法：
 *   const toast = useToast()
 *   toast.success('发送成功')
 *   toast.error('网络错误', 3000)
 *   toast.info('提示信息')
 */

const TOAST_DURATION = 2500
const MAX_TOASTS = 3

let toastIdCounter = 0

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = TOAST_DURATION) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  }

  return { toasts, toast }
}

/** Toast 渲染组件（放在 App 根节点） */
export function ToastContainer({ toasts }) {
  if (!toasts.length) return null

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>,
    document.body
  )
}

function ToastItem({ message, type }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const styles = {
    success: 'bg-emerald-500/90 text-white border-emerald-400',
    error: 'bg-red-500/90 text-white border-red-400',
    info: 'bg-blue-500/90 text-white border-blue-400',
    warning: 'bg-amber-500/90 text-white border-amber-400',
  }

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }

  return (
    <div className={`
      pointer-events-auto px-4 py-3 rounded-xl border backdrop-blur-lg shadow-lg
      flex items-center gap-3 min-w-[240px] max-w-[400px]
      transition-all duration-300 ease-out transform
      ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      ${styles[type] || styles.info}
    `}>
      <span className="text-base font-bold w-5 h-5 flex items-center justify-center rounded-full bg-white/20">
        {icons[type] || icons.info}
      </span>
      <span className="text-sm font-medium leading-tight">{message}</span>
    </div>
  )
}
