'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: Theme
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  resolvedTheme: 'dark',
})

export function ThemeProvider({ defaultTheme, children }: { defaultTheme: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  useEffect(() => {
    // Sync state with the class already applied by the server
    const active = document.documentElement.classList.contains('light') ? 'light' : 'dark'
    setThemeState(active)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    // Persist in cookie so the server can read it on next request
    document.cookie = `theme=${t}; path=/; max-age=31536000; SameSite=Lax`
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(t)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
