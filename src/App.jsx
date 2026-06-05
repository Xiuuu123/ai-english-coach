import { Routes, Route, Navigate } from 'react-router-dom'
import SceneSelectPage from './pages/SceneSelectPage'
import ChatPage from './pages/ChatPage'
import SummaryPage from './pages/SummaryPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SceneSelectPage />} />
      <Route path="/chat/:sceneId" element={<ChatPage />} />
      <Route path="/summary" element={<SummaryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}