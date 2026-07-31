import { useEffect, useState } from 'react'
import { useData } from '../state/store'
import { THEMES, themeById } from './themes'

/**
 * Applies the active skin to <html>. Because every screen paints with --p-*
 * only, this class swap is the entire theming mechanism — no component knows
 * which theme it is in.
 *
 * "Match system light/dark" resolves to Sorbetes by day, Ube Latte by night,
 * exactly as the Appearance screen promises.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useData()
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const active = profile.matchSystemTheme
    ? themeById(prefersDark ? 'ube' : 'sorbetes')
    : themeById(profile.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove(...THEMES.map((t) => t.className))
    root.classList.add(active.className)
    root.style.colorScheme = active.scheme

    const meta = document.querySelector('meta[name="theme-color"]')
    const color = getComputedStyle(root).getPropertyValue('--p-bg').trim()
    if (meta) meta.setAttribute('content', color)
    else {
      const tag = document.createElement('meta')
      tag.name = 'theme-color'
      tag.content = color
      document.head.appendChild(tag)
    }
  }, [active])

  return <>{children}</>
}
