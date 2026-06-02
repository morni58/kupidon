/* CupidBot API client — talks to the live FastAPI backend on Railway */
const BASE = import.meta.env.VITE_API_URL || ''

function authHeader() {
  const t = localStorage.getItem('cupid_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function req(path, { method = 'GET', body, raw, timeout = 20000 } = {}) {
  const headers = { ...authHeader() }
  let payload
  if (raw) { payload = raw }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, signal: ctrl.signal })
  } catch (e) {
    clearTimeout(timer)
    throw Object.assign(new Error(e.name === 'AbortError' ? 'timeout' : 'network_error'), { status: 0, data: { detail: 'Сеть недоступна' } })
  }
  clearTimeout(timer)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    // Token expired/invalid — let the app re-authenticate via Telegram (UX15).
    if (res.status === 401 && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('cupid-unauthorized')) } catch {}
    }
    throw Object.assign(new Error(err.detail || 'request_failed'), { status: res.status, data: err })
  }
  if (res.status === 204) return {}
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  // auth
  authTelegram: (init_data) => req('/api/auth/telegram', { method: 'POST', body: { init_data } }),
  getMe: () => req('/api/profile/me'),
  getMeFull: () => req('/api/profile/full'),
  myMedia: () => req('/api/media/mine'),
  onboarding: (data) => req('/api/onboarding', { method: 'POST', body: data }),
  updateProfile: (patch) => req('/api/profile/me', { method: 'PATCH', body: patch }),

  // tags
  getTags: () => req('/api/tags'),
  setTags: (ids) => req('/api/profile/tags', { method: 'POST', body: ids }),
  requestTag: (data) => req('/api/tags/request', { method: 'POST', body: data }),
  myTagRequests: () => req('/api/tags/requests/mine'),

  // feed / swipe
  getFeed: (verifiedOnly = false, tagIds = null) => {
    const qs = new URLSearchParams({ verified_only: String(verifiedOnly) })
    if (tagIds && tagIds.length) qs.set('tags', tagIds.join(','))
    return req(`/api/feed?${qs.toString()}`)
  },
  swipe: (target_id, action_type, vip_message) => req('/api/swipe', { method: 'POST', body: { target_id, action_type, vip_message } }),
  rewind: () => req('/api/rewind', { method: 'POST' }),

  // sympathies / views
  sympathies: () => req('/api/sympathies'),
  forceChat: (target_id) => req('/api/force_chat', { method: 'POST', body: { target_id } }),
  goldenContact: (target_id) => req('/api/buy_golden_contact', { method: 'POST', body: { target_id } }),
  whoViewedMe: () => req('/api/views/me'),
  recordView: (target_id) => req(`/api/views/${target_id}`, { method: 'POST' }),

  // safety
  report: (target_id, reason = 'abuse') => req('/api/report', { method: 'POST', body: { target_id, reason } }),
  block: (target_id) => req('/api/block', { method: 'POST', body: { target_id } }),

  // chats
  chats: () => req('/api/chats'),
  chatInfo: (matchId) => req(`/api/chats/${matchId}/info`),
  messages: (matchId) => req(`/api/chats/${matchId}/messages`),
  sendMessage: (matchId, content) => req(`/api/chats/${matchId}/messages`, { method: 'POST', body: { content, msg_type: 'text' } }),
  sendChatMedia: (matchId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return req(`/api/chats/${matchId}/media`, { method: 'POST', raw: fd })
  },
  burnMedia: (messageId) => req(`/api/media/burn/${messageId}`, { method: 'POST' }),
  requestTg: (matchId) => req(`/api/chats/${matchId}/request_tg`, { method: 'POST' }),
  approveTg: (matchId) => req(`/api/chats/${matchId}/approve_tg`, { method: 'POST' }),
  declineTg: (matchId) => req(`/api/chats/${matchId}/decline_tg`, { method: 'POST' }),
  markRead: (matchId) => req(`/api/chats/${matchId}/read`, { method: 'POST' }),
  icebreakers: () => req('/api/icebreakers'),

  // geo
  geoResolve: (lat, lng) => req('/api/geo/resolve', { method: 'POST', body: { lat, lng } }),
  geoSearch: (q) => req(`/api/geo/search?q=${encodeURIComponent(q)}`),
  setCity: (cityId) => req(`/api/geo/set_city/${cityId}`, { method: 'POST' }),
  setPlace: (place) => req('/api/geo/set_place', { method: 'POST', body: place }),

  // verify
  verifySelfie: () => req('/api/verify/selfie', { method: 'POST' }),

  // media
  uploadMedia: (slot, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return req(`/api/media/upload/${slot}`, { method: 'POST', raw: fd })
  },
  deleteMedia: (slot) => req(`/api/media/slot/${slot}`, { method: 'DELETE' }),
  reorderMedia: (order) => req('/api/media/reorder', { method: 'POST', body: order }),
  myMediaSlots: () => req('/api/media/mine'),
  uploadAnthem: (file) => { const fd = new FormData(); fd.append('file', file); return req('/api/media/anthem', { method: 'POST', raw: fd }) },
  deleteAnthem: () => req('/api/media/anthem', { method: 'DELETE' }),

  // payments
  createInvoice: (product) => req(`/api/payments/create_invoice?product=${product}`, { method: 'POST' }),

  // account
  exportData: () => req('/api/account/export'),
  deleteAccount: () => req('/api/account', { method: 'DELETE' }),
}

// WebSocket for chat with Long-Polling fallback
export function createChatWS(matchId, onMessage) {
  const token = localStorage.getItem('cupid_token')
  const wsBase = import.meta.env.VITE_WS_URL || (BASE ? BASE.replace(/^http/, 'ws') : '')
  let ws = null, polling = null, closed = false
  function connect() {
    try {
      ws = new WebSocket(`${wsBase}/ws/chat/${matchId}?token=${token}`)
      ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch {} }
      ws.onerror = () => startPolling()
      ws.onclose = () => { if (!closed) startPolling() }
    } catch { startPolling() }
  }
  function startPolling() {
    if (polling) return
    polling = setInterval(async () => {
      try { const m = await api.messages(matchId); onMessage({ type: 'poll', messages: m }) } catch {}
    }, 3000)
  }
  connect()
  return {
    send: (d) => ws?.readyState === 1 && ws.send(JSON.stringify(d)),
    close: () => { closed = true; ws?.close(); if (polling) clearInterval(polling) },
  }
}

// Resolve a media path to an absolute URL the browser can load cross-origin.
// Backend usually returns absolute URLs now; this is a safety net for any
// relative "/media/..." paths (U-MEDIA).
export function mediaUrl(u) {
  if (!u) return u
  if (/^https?:\/\//.test(u)) return u
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  return base + (u.startsWith('/') ? u : '/' + u)
}

// Telegram WebApp helpers
export const tg = (typeof window !== 'undefined' && window.Telegram?.WebApp) || null
export function haptic(type = 'light') {
  try {
    if (type === 'success' || type === 'error' || type === 'warning') tg?.HapticFeedback?.notificationOccurred?.(type)
    else tg?.HapticFeedback?.impactOccurred?.(type)
  } catch {}
}
export function openInvoice(link) {
  return new Promise((resolve) => {
    if (tg?.openInvoice) tg.openInvoice(link, (status) => resolve(status))
    else { window.open(link, '_blank'); resolve('unknown') }
  })
}
