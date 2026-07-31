import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/tokens.css'
import './styles/global.css'
import './styles/app.css'
import { App } from './App'
import { StoreProvider } from './state/store'
import { ThemeProvider } from './theme/ThemeProvider'

/**
 * Register the service worker in production only. In dev it would cache the
 * module graph Vite is busy rewriting, and you would spend an afternoon
 * wondering why your edits do nothing.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', import.meta.url), { scope: './' }).catch(() => {
      // Not fatal: without it the app simply needs a connection to open.
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StoreProvider>
  </StrictMode>,
)
