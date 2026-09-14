import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { DashboardPage } from './dashboard/DashboardPage'
import { EditorPage } from './editor/EditorPage'

const router = createBrowserRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/diagrams/:id', element: <EditorPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App(): JSX.Element {
  return <RouterProvider router={router} />
}