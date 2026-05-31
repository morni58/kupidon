const BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cupid_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail || 'Request failed'), { status: res.status, data: err })
  }
  if (res.status === 204) return {} as T
  return res.json()
}

export const api = {
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// WebSocket factory with Long Polling fallback
export function createChatWS(matchId: string, token: string, onMessage: (d: unknown) => void) {
  const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000') + `/ws/chat/${matchId}?token=${token}`
  let ws: WebSocket | null = null
  let polling: ReturnType<typeof setInterval> | null = null
  let closed = false

  function connect() {
    try {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (e) => onMessage(JSON.parse(e.data))
      ws.onerror = () => startPolling()
      ws.onclose = () => { if (!closed) startPolling() }
    } catch {
      startPolling()
    }
  }

  function startPolling() {
    if (polling) return
    polling = setInterval(async () => {
      try {
        const msgs = await api.get<unknown[]>(`/api/chats/${matchId}/messages`)
        onMessage({ type: 'poll_messages', messages: msgs })
      } catch { /* ignore */ }
    }, 3000)
  }

  connect()
  return {
    send: (data: unknown) => ws?.readyState === 1 && ws.send(JSON.stringify(data)),
    close: () => {
      closed = true
      ws?.close()
      if (polling) clearInterval(polling)
    },
  }
}
