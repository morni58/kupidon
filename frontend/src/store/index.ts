import { create } from 'zustand'

export type Theme = 'light' | 'room18' | 'oligarch'

interface User {
  id: string
  name: string
  gender?: string
  tier: 'free' | 'premium' | 'kupidon'
  swipes_left: number
  superlikes_left: number
  is_verified: boolean
  is_18_mode_active: boolean
  is_oligarch_mode: boolean
  is_anti_oligarch: boolean
  is_stealth_mode: boolean
  vip_signals_used: number
  streak_days: number
  profile_score: number
}

interface AppState {
  token: string | null
  user: User | null
  theme: Theme
  setToken: (t: string) => void
  setUser: (u: User) => void
  setTheme: (t: Theme) => void
  logout: () => void
}

export const useStore = create<AppState>((set) => ({
  token: localStorage.getItem('cupid_token'),
  user: null,
  theme: 'light',
  setToken: (token) => {
    localStorage.setItem('cupid_token', token)
    set({ token })
  },
  setUser: (user) => set({ user }),
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? '' : theme)
    set({ theme })
  },
  logout: () => {
    localStorage.removeItem('cupid_token')
    set({ token: null, user: null })
  },
}))
