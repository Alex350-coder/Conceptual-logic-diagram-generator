import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { DashboardPage } from './dashboard/DashboardPage'
import { EditorPage } from './editor/EditorPage'

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/diagrams/:id" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}