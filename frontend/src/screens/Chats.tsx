import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface MatchItem { id: string; user1_id: string; user2_id: string; messages_count: number; created_at: string; is_18_room: boolean }

export function Chats() {
  const navigate = useNavigate()
  const [chats, setChats] = useState<MatchItem[]>([])

  useEffect(() => { api.get<MatchItem[]>('/api/chats').then(setChats).catch(() => {}) }, [])

  return (
    <div className="h-full flex flex-col pb-16 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="px-5 py-4">
        <h1 className="text-2xl font-black mb-1">Чаты 💬</h1>
        <p className="text-sm text-gray-400">Твои совпадения</p>
      </div>
      <div className="px-4 space-y-2">
        {chats.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">💬</div>
            <p className="font-medium">Нет чатов. Свайпай — и они появятся!</p>
          </div>
        )}
        {chats.map(c => (
          <div key={c.id} onClick={() => navigate(`/chats/${c.id}`)}
            className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm cursor-pointer active:scale-[0.99]"
            style={c.is_18_room ? { borderLeft: '3px solid #FF3333' } : {}}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF00FF] to-[#FF66CC] flex items-center justify-center text-white text-xl font-black shrink-0">
              {c.is_18_room ? '🔥' : '💕'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">Match {c.id.slice(0, 8)}...</p>
              <p className="text-xs text-gray-400">{c.messages_count} сообщений</p>
            </div>
            <span className="text-xs text-gray-300">{new Date(c.created_at).toLocaleDateString('ru')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
