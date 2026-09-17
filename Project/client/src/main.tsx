import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { readStoredTheme } from './app/theme/ThemeContext'
import './styles/tokens.css'
import './styles/themes.css'
import './styles/base.css'

document.documentElement.dataset.theme = readStoredTheme()

const rootEl = document.getElementById('root')
if (rootEl === null) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)