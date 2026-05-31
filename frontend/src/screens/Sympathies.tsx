import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../store'
import { PaywallModal } from '../components/PaywallModal'

interface SympathyItem {
  user_id: string; name: string; is_verified: boolean
  is_vip: boolean; vip_info?: { message?: string }
  media: string[]; liked_at: string
}

export function Sympathies() {
  const user = useStore(s => s.user)
  const [items, setItems] = useState<SympathyItem[]>([])
  const [paywall, setPaywall] = useState<string | null>(null)

  useEffect(() => {
    api.get<SympathyItem[]>('/api/sympathies').then(setItems).catch(() => {})
  }, [])

  async function forceChat(targetId: string) {
    if (user?.tier === 'free') { setPaywall('Врыв доступен с Premium'); return }
    try {
      await api.post('/api/force_chat', { target_id: targetId })
      alert('Чат открыт!')
    } catch (e: any) {
      if (e.status === 429) setPaywall('Лимит врывов на сегодня')
      else alert(e.message)
    }
  }

  return (
    <div className="h-full flex flex-col pb-16 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="px-5 py-4">
        <h1 className="text-2xl font-black mb-1">Симпатии ❤️</h1>
        <p className="text-sm text-gray-400">Они лайкнули тебя</p>
      </div>

      <div className="px-4 space-y-3">
        {items.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">💔</div>
            <p className="font-medium">Пока никто не лайкнул. Свайпай активнее!</p>
          </div>
        )}

        {items.map(item => (
          <div key={item.user_id}
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4"
            style={item.is_vip ? { border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.05)' } : {}}>

            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-cover bg-center bg-gray-100 shrink-0 relative"
              style={{ backgroundImage: item.media[0] ? `url(${item.media[0]})` : undefined }}>
              {item.is_vip && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'linear-gradient(135deg,#FFE259,#FFA751)' }}>👑</div>
              )}
              {!item.media[0] && <div className="w-full h-full rounded-2xl bg-gray-200 flex items-center justify-center text-2xl">👤</div>}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {item.is_vip ? (
                <>
                  <p className="font-bold text-sm" style={{ color: '#FFA751' }}>👑 VIP проявил интерес</p>
                  {item.vip_info?.message && <p className="text-xs text-gray-500 mt-0.5">«{item.vip_info.message}»</p>}
                </>
              ) : (
                <p className="font-bold text-gray-800">{item.name} {item.is_verified ? '✓' : ''}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">Лайкнул(а) недавно</p>
            </div>

            {/* Action */}
            <button onClick={() => forceChat(item.user_id)}
              className="text-white text-sm font-bold px-4 py-2 rounded-xl shrink-0"
              style={{ background: item.is_vip ? 'linear-gradient(135deg,#FFE259,#FFA751)' : 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
              {item.is_vip ? 'Раскрыть' : 'Написать'}
            </button>
          </div>
        ))}
      </div>

      {paywall && <PaywallModal reason={paywall} onClose={() => setPaywall(null)} />}
    </div>
  )
}
