import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { useState } from 'react'

interface Tag { id: number; name: string; color_hex: string; emoji?: string }
interface CardData {
  id: string; name: string; birth_date: string; bio?: string
  is_verified: boolean; media: string[]; tags: Tag[]
  common_tags_count: number; lat?: number; lng?: number
}

interface Props {
  card: CardData
  onSwipe: (dir: 'left' | 'right' | 'superlike') => void
  onRewind?: () => void
}

function age(birth_date: string) {
  const d = new Date(birth_date)
  const now = new Date()
  return now.getFullYear() - d.getFullYear() -
    (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0)
}

function haptic(type: 'light' | 'medium' | 'heavy') {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(type) } catch {}
}

export function SwipeCard({ card, onSwipe, onRewind }: Props) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-25, 25])
  const likeOpacity = useTransform(x, [20, 100], [0, 1])
  const nopeOpacity = useTransform(x, [-100, -20], [1, 0])
  const [imgIdx, setImgIdx] = useState(0)

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 100
    if (info.offset.x > threshold) {
      haptic('medium')
      onSwipe('right')
    } else if (info.offset.x < -threshold) {
      haptic('light')
      onSwipe('left')
    } else if (info.offset.y < -threshold) {
      haptic('heavy')
      onSwipe('superlike')
    }
  }

  const bg = card.media[imgIdx] || `https://placehold.co/400x600/e2e8f0/94a3b8?text=${encodeURIComponent(card.name)}`

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      <motion.div
        className="absolute w-[90vw] max-w-sm aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
        style={{ x, rotate, backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
      >
        {/* LIKE label */}
        <motion.div style={{ opacity: likeOpacity }}
          className="absolute top-8 left-6 border-4 border-green-400 text-green-400 text-2xl font-black px-4 py-2 rounded-xl rotate-[-20deg]">
          ЛАЙК ❤️
        </motion.div>
        {/* NOPE label */}
        <motion.div style={{ opacity: nopeOpacity }}
          className="absolute top-8 right-6 border-4 border-red-400 text-red-400 text-2xl font-black px-4 py-2 rounded-xl rotate-[20deg]">
          НЕТ 👎
        </motion.div>

        {/* Verified badge */}
        {card.is_verified && (
          <div className="absolute top-4 right-4 bg-blue-500/90 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            ✓ Verified
          </div>
        )}

        {/* Photo dots */}
        {card.media.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4">
            {card.media.map((_, i) => (
              <div key={i} onClick={() => setImgIdx(i)}
                className={`h-1 flex-1 rounded-full ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 flex">
          <div className="flex-1" onClick={() => setImgIdx(Math.max(0, imgIdx - 1))} />
          <div className="flex-1" onClick={() => setImgIdx(Math.min(card.media.length - 1, imgIdx + 1))} />
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
        <div className="absolute bottom-20 left-4 right-4 text-white">
          <h2 className="text-2xl font-bold">{card.name}, {age(card.birth_date)}</h2>
          {card.bio && <p className="text-sm text-gray-300 mt-1 line-clamp-2">{card.bio}</p>}
          {card.common_tags_count > 0 && (
            <span className="mt-2 inline-block px-2 py-0.5 bg-emerald-500/30 border border-emerald-300/40 backdrop-blur-md rounded-full text-xs font-bold">
              ✓ {card.common_tags_count} общих тега
            </span>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {card.tags.slice(0, 3).map(t => (
              <span key={t.id} className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold border border-white/30">
                {t.emoji} {t.name}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="absolute bottom-4 flex items-center justify-center gap-4">
        {onRewind && (
          <button onClick={() => { haptic('light'); onRewind() }}
            className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-amber-500 text-xl">⏪</button>
        )}
        <button onClick={() => { haptic('light'); onSwipe('left') }}
          className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-3xl">✕</button>
        <button onClick={() => { haptic('medium'); onSwipe('right') }}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-3xl"
          style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>♥</button>
        <button onClick={() => { haptic('heavy'); onSwipe('superlike') }}
          className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-purple-600 text-xl relative">
          ⭐
        </button>
      </div>
    </div>
  )
}
