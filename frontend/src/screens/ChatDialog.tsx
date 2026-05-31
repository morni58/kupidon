import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, createChatWS } from '../api/client'
import { ConsentBubble } from '../components/ConsentBubble'
import { useStore } from '../store'

interface Msg { id: string; sender_id: string; content?: string; msg_type: string; created_at: string; is_disappearing: boolean; is_burned: boolean }

export function ChatDialog() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const token = useStore(s => s.token)
  const user = useStore(s => s.user)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [icebreakers, setIcebreakers] = useState<string[]>([])
  const [consentRequest, setConsentRequest] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!matchId) return
    api.get<Msg[]>(`/api/chats/${matchId}/messages`).then(setMessages).catch(() => {})
    api.get<string[]>('/api/icebreakers').then(setIcebreakers).catch(() => {})

    const ws = createChatWS(matchId, token!, (data: any) => {
      if (data.type === 'message_sent') setMessages(m => [...m, data.message])
      if (data.type === 'tg_consent_request') setConsentRequest(data.from_id)
      if (data.type === 'poll_messages') setMessages(data.messages)
    })
    return () => ws.close()
  }, [matchId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(content: string) {
    if (!content.trim()) return
    setText('')
    try {
      const msg = await api.post<Msg>(`/api/chats/${matchId}/messages`, { content, msg_type: 'text' })
      setMessages(m => [...m, msg])
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="text-xl">←</button>
        <div className="flex-1">
          <p className="font-bold">Чат</p>
          <p className="text-xs text-gray-400">Match {matchId?.slice(0, 8)}</p>
        </div>
        <button onClick={() => api.post(`/api/chats/${matchId}/request_tg`).catch(() => {})}
          className="text-2xl opacity-50">✈️</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map(msg => {
          const mine = msg.sender_id === user?.id
          if (msg.msg_type === 'consent') {
            return <ConsentBubble key={msg.id} matchId={matchId!} fromId={msg.sender_id}
              onDone={() => setConsentRequest(null)} />
          }
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium ${mine
                ? 'text-white rounded-tr-none'
                : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}
                style={mine ? { background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' } : {}}>
                {msg.content}
                {msg.is_disappearing && !msg.is_burned && <span className="ml-1 text-orange-400">🔥</span>}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Icebreakers */}
      {messages.length === 0 && icebreakers.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {icebreakers.map(ic => (
            <button key={ic} onClick={() => send(ic)}
              className="shrink-0 bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-700 px-3 py-1.5 rounded-full text-xs font-bold">
              {ic}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-100 pb-safe">
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 flex items-center">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(text)}
            placeholder="Сообщение..." className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <button onClick={() => send(text)}
          disabled={!text.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>➤</button>
      </div>
    </div>
  )
}
