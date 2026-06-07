import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import SceneSelectPage from './pages/SceneSelectPage'
import ChatPage from './pages/ChatPage'
import SummaryPage from './pages/SummaryPage'
import VipPage from './pages/VipPage'
import { useToast, ToastContainer } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  const { toasts, toast } = useToast()

  // 全局暴露 toast（供子组件通过自定义事件调用）
  useEffect(() => {
    window.__toast = toast
    return () => { delete window.__toast }
  }, [toast])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<SceneSelectPage />} />
        <Route path="/chat/:sceneId" element={<ChatPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/vip" element={<VipPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer toasts={toasts} />
    </ErrorBoundary>
  )
}
