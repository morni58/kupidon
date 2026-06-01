/* CupidBot — branded loading system: boot splash + shimmer skeletons */
import { useState, useEffect } from 'react'
import { MeshBG, VIBES, THEME_MESH } from './fx'

// Rotating witty microcopy under the splash
const BOOT_LINES = [
  'Ищем твою половинку…',
  'Раскладываем анкеты…',
  'Подбираем по вайбу…',
  'Согреваем сердца…',
  'Чистим от ботов…',
  'Почти готово…',
]

// ─── Full-screen branded boot splash ───
export function BootLoader({ palette }) {
  const [line, setLine] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % BOOT_LINES.length), 1400)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center">
      <MeshBG palette={palette || VIBES.neon} grainOpacity={0.06} />
      <div className="relative z-10 flex flex-col items-center">
        {/* heart with glow + orbiting sparks */}
        <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
          <div className="heart-glow absolute rounded-full" style={{ width: 120, height: 120, background: 'radial-gradient(circle, rgba(255,0,255,0.6), transparent 70%)', filter: 'blur(6px)' }} />
          {[0, 1, 2].map((i) => (
            <span key={i} className="absolute" style={{ animation: `orbit ${2.4 + i * 0.5}s linear infinite`, animationDelay: `${i * 0.5}s` }}>
              <span className="block rounded-full" style={{ width: 7, height: 7, background: ['#FF00FF', '#FFD700', '#FF66CC'][i], boxShadow: `0 0 8px ${['#FF00FF', '#FFD700', '#FF66CC'][i]}` }} />
            </span>
          ))}
          <div className="heartbeat relative" style={{ fontSize: 72, filter: 'drop-shadow(0 8px 24px rgba(255,0,255,0.5))' }}>💖</div>
        </div>

        {/* wordmark with shimmer sweep */}
        <div className="relative mt-3 overflow-hidden">
          <h1 className="text-[30px] font-black tracking-tight" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CupidBot</h1>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.7) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s ease-in-out infinite' }} />
        </div>

        {/* rotating microcopy */}
        <p key={line} className="mt-2 text-[13px] font-semibold text-[#6b7280]" style={{ animation: 'fadeSwap 1.4s ease-in-out' }}>{BOOT_LINES[line]}</p>

        {/* indeterminate sweep bar */}
        <div className="mt-5 w-[150px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,0,255,0.12)' }}>
          <div className="bar-sweep h-full w-1/3 rounded-full" style={{ background: 'linear-gradient(90deg,#FF00FF,#FF66CC)' }} />
        </div>
      </div>
    </div>
  )
}

// ─── shimmer block primitive ───
export function Shimmer({ className = '', style = {}, dark = false, rounded = 16 }) {
  return (
    <div className={'relative overflow-hidden ' + className} style={{ borderRadius: rounded, background: dark ? 'rgba(255,255,255,0.06)' : '#e9eaf0', ...style }}>
      <div className={'absolute inset-0 ' + (dark ? 'shimmer-dark' : 'shimmer')} />
    </div>
  )
}

// ─── Feed card skeleton (matches swipe card shape) ───
export function SkeletonFeed({ dark = false }) {
  return (
    <div className="relative w-full h-full">
      <Shimmer className="absolute inset-0" rounded={32} dark={dark} />
      <div className="absolute inset-x-3 bottom-3 rounded-[1.6rem] p-4" style={{ background: dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.55)', backdropFilter: 'blur(8px)' }}>
        <Shimmer className="h-7 w-2/3 mb-2" rounded={10} dark={dark} />
        <Shimmer className="h-4 w-1/3 mb-3" rounded={8} dark={dark} />
        <div className="flex gap-2">
          <Shimmer className="h-7 w-20" rounded={999} dark={dark} />
          <Shimmer className="h-7 w-24" rounded={999} dark={dark} />
        </div>
      </div>
    </div>
  )
}

// ─── List rows skeleton (likes / chats) ───
export function SkeletonRows({ count = 5, dark = false }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-3xl p-3" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)' }}>
          <Shimmer className="w-16 h-16 shrink-0" rounded={16} dark={dark} />
          <div className="flex-1">
            <Shimmer className="h-4 w-1/2 mb-2" rounded={8} dark={dark} />
            <Shimmer className="h-3 w-1/3" rounded={6} dark={dark} />
          </div>
          <Shimmer className="h-9 w-20 shrink-0" rounded={999} dark={dark} />
        </div>
      ))}
    </div>
  )
}

// ─── Profile skeleton (cover + cards) ───
export function SkeletonProfile({ dark = false }) {
  return (
    <div className="w-full h-full overflow-hidden">
      <Shimmer className="w-full" style={{ height: 'clamp(360px, 54vh, 460px)', borderRadius: '0 0 2rem 2rem' }} rounded={0} dark={dark} />
      <div className="screen-pad pt-4 space-y-3">
        <Shimmer className="h-24 w-full" rounded={24} dark={dark} />
        <div className="grid grid-cols-3 gap-3">
          <Shimmer className="h-20" rounded={24} dark={dark} />
          <Shimmer className="h-20" rounded={24} dark={dark} />
          <Shimmer className="h-20" rounded={24} dark={dark} />
        </div>
        <Shimmer className="h-16 w-full" rounded={24} dark={dark} />
      </div>
    </div>
  )
}
