import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: theme => {
        applyTheme(theme)
        set({ theme })
      },
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      }
    }),
    {
      name: 'installment-store-theme',
      onRehydrateStorage: () => state => {
        if (state) applyTheme(state.theme)
      }
    }
  )
)

export function initializeTheme(): void {
  const t = useThemeStore.getState().theme
  applyTheme(t)
}
