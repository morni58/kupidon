import { create } from 'zustand'
import { api } from './api'
import { PLANS } from '../design/data'

// Cosmetic-only profile prefs persisted locally
const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem('cupid_prefs') || '{}') } catch { return {} }
}
const prefs = loadPrefs()

export const useStore = create((set, get) => ({
  token: localStorage.getItem('cupid_token'),
  screen: 'loading',       // loading | onboarding | feed | likes | chats | dialog | profile | verify | pricing
  me: null,                // raw API profile
  activeChat: null,
  toast: null,
  vibe: prefs.vibe || 'neon',
  frame: prefs.frame || 'glow',
  anthem: prefs.anthem !== false,

  setScreen: (screen) => set({ screen }),
  setActiveChat: (activeChat) => set({ activeChat }),
  openChat: (id) => set({ activeChat: id, screen: 'dialog' }),

  setToast: (toast) => {
    set({ toast })
    clearTimeout(get()._tt)
    const _tt = setTimeout(() => set({ toast: null }), 2200)
    set({ _tt })
  },

  setPref: (patch) => {
    const next = { vibe: get().vibe, frame: get().frame, anthem: get().anthem, ...patch }
    localStorage.setItem('cupid_prefs', JSON.stringify(next))
    set(patch)
  },

  setToken: (token) => { localStorage.setItem('cupid_token', token); set({ token }) },

  refreshMe: async () => {
    const me = await api.getMe()
    set({ me })
    return me
  },

  // derive plan + theme + settings from API "me"
  plan: () => PLANS[get().me?.tier] || PLANS.free,
  theme: () => {
    const me = get().me
    if (!me) return 'light'
    if (me.is_18_mode_active) return 'adult'
    if (me.tier === 'kupidon' && me.is_stealth_mode) return 'oligarch'
    return 'light'
  },
  settings: () => {
    const me = get().me || {}
    return {
      verified: !!me.is_verified, adult: !!me.is_18_mode_active, shield: !!me.is_anti_oligarch,
      stealth: !!me.is_stealth_mode, vibe: get().vibe, frame: get().frame, anthem: get().anthem,
    }
  },

  logout: () => { localStorage.removeItem('cupid_token'); set({ token: null, me: null, screen: 'onboarding' }) },
}))
