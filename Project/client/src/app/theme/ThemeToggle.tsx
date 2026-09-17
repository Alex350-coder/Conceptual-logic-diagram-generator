import { useTheme } from './ThemeContext'
import './theme.css'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Cambiar a tema ${next === 'light' ? 'claro' : 'oscuro'}`}
      aria-pressed={theme === 'dark'}
      title={`Tema ${theme === 'dark' ? 'oscuro' : 'claro'} (pulsa para cambiar)`}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === 'dark' ? '☾' : '☀'}
      </span>
      {theme === 'dark' ? 'Oscuro' : 'Claro'}
    </button>
  )
}