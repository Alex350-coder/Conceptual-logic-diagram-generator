import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { DashboardPage } from './dashboard/DashboardPage'

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/diagrams/:id" element={<div>Editor placeholder</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}