import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getToken } from './api'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TodoPage from './pages/TodoPage'
import './App.css'

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken())
    return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<RequireAuth><TodoPage /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
