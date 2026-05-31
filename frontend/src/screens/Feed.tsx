import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwipeCard } from '../components/SwipeCard'
import { MatchModal } from '../components/MatchModal'
import { PaywallModal } from '../components/PaywallModal'
import { api } from '../api/client'
import { useStore } from '../store'

interface FeedCard {
  id: string; name: string; birth_date: string; bio?: string
  is_verified: boolean; media: string[]; tags: any[]; common_tags_count: number
}

export function Feed() {
  const user = useStore(s => s.user)
  const [cards, setCards] = useState<FeedCard[]>([])
  const [loading, setLoading] = useState(true)
  const [matchInfo, setMatchInfo] = useState<{ id: string; name: string } | null>(null)
  const [paywall, setPaywall] = useState<string | null>(null)
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<FeedCard[]>(`/api/feed?verified_only=${verifiedOnly}`)
      setCards(prev => [...prev, ...data])
    } catch { }
    setLoading(false)
  }, [verifiedOnly])

  useEffect(() => { loadFeed() }, [loadFeed])

  // Preload more when ≤3 left
  useEffect(() => { if (cards.length <= 3 && !loading) loadFeed() }, [cards.length])

  async function onSwipe(dir: 'left' | 'right' | 'superlike') {
    const card = cards[0]
    if (!card) return
    setCards(c => c.slice(1))

    try {
      const res = await api.post<{ is_match: boolean; match_id?: string }>('/api/swipe', {
        target_id: card.id,
        action_type: dir,
      })
      if (res.is_match && res.match_id) {
        setMatchInfo({ id: res.match_id, name: card.name })
      }
    } catch (e: any) {
      if (e.status === 429) setPaywall('Свайпы на сегодня закончились. Обнови до Premium 💘')
      if (e.status === 402) setPaywall('Суперлайки закончились. Купи ещё ⭐')
    }
  }

  async function onRewind() {
    try {
      await api.post('/api/rewind')
      setCards(c => c) // trigger reload
      loadFeed()
    } catch (e: any) {
      if (e.status === 403) setPaywall('Rewind доступен только в Premium')
    }
  }

  return (
    <div className="h-full flex flex-col pb-16" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <h1 className="text-2xl font-black" style={{ color: 'var(--accent)' }}>CupidBot</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setVerifiedOnly(v => !v); setCards([]) }}
            className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${verifiedOnly ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-500'}`}>
            ✓ Только Verified
          </button>
          <span className="text-xs font-bold text-gray-400">{user?.swipes_left ?? 0} свайпов</span>
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 relative overflow-hidden">
        {loading && cards.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        )}

        {!loading && cards.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="text-5xl mb-4">🌎</div>
            <h2 className="text-2xl font-black mb-2">Анкеты закончились</h2>
            <p className="text-gray-400 font-medium">Возвращайся завтра или расширь радиус поиска</p>
          </div>
        )}

        <AnimatePresence>
          {cards.slice(0, 3).reverse().map((card, i, arr) => (
            <motion.div key={card.id}
              className="absolute inset-0"
              style={{ zIndex: i === arr.length - 1 ? 10 : i }}
              initial={{ scale: 0.95 - (arr.length - 1 - i) * 0.03 }}
              animate={{ scale: 1 - (arr.length - 1 - i) * 0.03 }}>
              {i === arr.length - 1 && (
                <SwipeCard card={card} onSwipe={onSwipe} onRewind={user?.tier !== 'free' ? onRewind : undefined} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {matchInfo && (
        <MatchModal matchId={matchInfo.id} partnerName={matchInfo.name} onClose={() => setMatchInfo(null)} />
      )}
      {paywall && <PaywallModal reason={paywall} onClose={() => setPaywall(null)} />}
    </div>
  )
}
