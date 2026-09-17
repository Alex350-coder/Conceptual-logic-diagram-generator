import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { DashboardPage } from './dashboard/DashboardPage'
import { EditorPage } from './editor/EditorPage'
import { ThemeProvider } from './theme/ThemeContext'

const router = createBrowserRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/diagrams/:id', element: <EditorPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}