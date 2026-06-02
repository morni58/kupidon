import { create } from 'zustand'
import { api } from './api'
import { PLANS } from '../design/data'
import { VIBES, THEME_MESH, darkVibe } from '../design/fx'

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
  uiTheme: prefs.uiTheme || 'light',   // light | dark (visual; separate from 18+ mode)
  anthemTrack: prefs.anthemTrack || null, // {name, url} chosen profile anthem

  viewUserId: null,
  prevScreen: 'feed',
  setScreen: (screen) => set({ screen }),
  setActiveChat: (activeChat) => set({ activeChat }),
  openChat: (id) => set({ activeChat: id, screen: 'dialog' }),
  openUser: (id) => set((s) => ({ viewUserId: id, prevScreen: s.screen === 'user' ? s.prevScreen : s.screen, screen: 'user' })),

  setToast: (toast) => {
    set({ toast })
    clearTimeout(get()._tt)
    const _tt = setTimeout(() => set({ toast: null }), 2200)
    set({ _tt })
  },

  setPref: (patch) => {
    const cur = get()
    const next = { vibe: cur.vibe, frame: cur.frame, anthem: cur.anthem, uiTheme: cur.uiTheme, anthemTrack: cur.anthemTrack, ...patch }
    localStorage.setItem('cupid_prefs', JSON.stringify(next))
    set(patch)
  },

  setToken: (token) => { localStorage.setItem('cupid_token', token); set({ token }) },

  refreshMe: async () => {
    const me = await api.getMe()
    set({ me })
    return me
  },

  // ── Prefetch caches: filled right after auth so Feed/Profile render instantly ──
  feedCache: null,        // array of raw API feed cards (verified_only=false)
  meFullCache: null,      // enriched /profile/full
  feedCacheAt: 0,
  consumeFeedCache: () => { const c = get().feedCache; set({ feedCache: null }); return c },
  prefetch: async () => {
    // Fire both in parallel; ignore failures (cache is best-effort).
    api.getFeed(false).then((cards) => set({ feedCache: cards, feedCacheAt: Date.now() })).catch(() => {})
    api.getMeFull().then((full) => set({ meFullCache: full })).catch(() => {})
  },

  // derive plan + theme + settings from API "me"
  plan: () => PLANS[get().me?.tier] || PLANS.free,
  theme: () => {
    const me = get().me
    const ui = get().uiTheme === 'dark' ? 'dark' : 'light'
    if (!me) return ui
    if (me.is_18_mode_active) return 'adult'        // content mode forces its theme
    if (me.tier === 'kupidon' && me.is_stealth_mode) return 'oligarch'
    return ui
  },
  // Concrete palette + accent for the current theme & chosen vibe — used by ALL
  // screens so customization applies everywhere (U-THEMES / U-CUSTOM).
  palette: () => {
    const t = get().theme()
    const vibe = VIBES[get().vibe] || VIBES.neon
    if (t === 'adult' || t === 'oligarch') return THEME_MESH[t]
    if (t === 'dark') return darkVibe(vibe)
    return vibe
  },
  accent: () => {
    const t = get().theme()
    if (t === 'adult') return '#FF3333'
    if (t === 'oligarch') return '#FFD700'
    return (VIBES[get().vibe] || VIBES.neon).accent
  },
  isDark: () => {
    const t = get().theme()
    return t === 'adult' || t === 'oligarch' || t === 'dark'
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
