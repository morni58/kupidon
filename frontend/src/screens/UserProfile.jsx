import { useState, useEffect, useRef } from 'react'
import { MeshBG, VIBES, Grain, hexA } from '../design/fx'
import { Photo, Pill, VerifiedTick, Button } from '../design/ui'
import { gradPhoto, interestById } from '../design/data'
import { api, mediaUrl, haptic } from '../lib/api'
import { SkeletonProfile } from '../design/loaders'
import { AnthemPlayer, PromptsView } from './ProfileExtras'

const PLAN_BADGE = { premium: 'Premium 💎', kupidon: 'Kupidon 👑' }

// Read-only profile of another person, opened from a feed card / likes / chat.
export function UserProfile({ userId, palette, accent = '#FF00FF', dark = false, onBack, onLike, onMessage, setToast }) {
  const [p, setP] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [err, setErr] = useState(false)

  useEffect(() => {
    setP(null); setErr(false)
    api.publicProfile(userId).then(setP).catch(() => setErr(true))
  }, [userId])

  if (err) return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-8" style={{ background: '#FAFAFC' }}>
      <div className="text-[56px]">🚫</div>
      <h2 className="text-[20px] font-black mt-2">Профиль недоступен</h2>
      <p className="text-[14px] text-[#6b7280] mt-1">Возможно, анкета скрыта или удалена.</p>
      <div className="mt-6 w-full max-w-xs"><Button variant="secondary" onClick={onBack}>Назад</Button></div>
    </div>
  )
  if (!p) return <SkeletonProfile dark={dark} />

  const photos = (p.media && p.media.length ? p.media.map((url) => ({ url: mediaUrl(url) })) : [gradPhoto((p.name || '?').charCodeAt(0), '😎')])

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette || VIBES.neon} />
      <div onScroll={(e) => setScrollY(e.target.scrollTop)} className="relative z-10 w-full h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
        {/* cover */}
        <div className="relative" style={{ height: 'clamp(380px, 58vh, 500px)' }}>
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '0 0 2rem 2rem', transform: `translateY(${scrollY * 0.3}px) scale(${1 + scrollY * 0.0004})`, transformOrigin: 'top' }}>
            <Photo data={photos[photoIdx]} rounded="0 0 2rem 2rem" className="w-full h-full" emojiSize={172} />
            <Grain opacity={0.08} blend="overlay" />
          </div>
          {/* photo dots */}
          <div className="absolute top-3 left-3 right-3 flex gap-1.5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {photos.map((_, i) => <div key={i} className="flex-1 rounded-full" style={{ height: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)' }} />)}
          </div>
          {/* back */}
          <button onClick={onBack} className="absolute z-20 left-3 w-10 h-10 rounded-full flex items-center justify-center" style={{ top: 'calc(env(safe-area-inset-top) + 10px)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
            <i className="ph-bold ph-arrow-left text-white text-[18px]" />
          </button>
          {/* tap zones */}
          <div className="absolute left-0 top-20 bottom-24 w-1/2" onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))} />
          <div className="absolute right-0 top-20 bottom-24 w-1/2" onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))} />
          {/* name plate */}
          <div className="absolute inset-x-3 bottom-3 rounded-[1.5rem] px-4 py-3.5 overflow-hidden" style={{ background: 'rgba(16,12,22,0.4)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[28px] font-black text-white leading-none tracking-tight truncate">{p.name}{p.age ? `, ${p.age}` : ''}</h1>
              {p.is_verified && <VerifiedTick size={22} />}
              {PLAN_BADGE[p.tier] && <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: p.tier === 'kupidon' ? 'linear-gradient(135deg,#FFE259,#FFA751)' : 'rgba(255,0,255,0.9)', color: p.tier === 'kupidon' ? '#0F0F13' : '#fff' }}>{PLAN_BADGE[p.tier]}</span>}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold flex items-center gap-1 truncate" style={{ color: 'rgba(255,255,255,0.85)' }}><i className="ph-fill ph-map-pin" style={{ color: accent }} /> {p.city_name || 'Рядом'}</p>
              {p.anthem_url && <AnthemPlayer url={p.anthem_url} title={p.anthem_title} start={p.anthem_start} accent="#fff" />}
            </div>
            {p.likes_me && <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,0,255,0.25)', color: '#fff' }}><i className="ph-fill ph-heart" /> Уже лайкнул(а) тебя</div>}
          </div>
        </div>

        <div className="screen-pad pt-4 space-y-3">
          {p.tag_ids?.length > 0 && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: dark ? '#fff' : '#0F0F13' }}>Интересы</h3>
              <div className="flex flex-wrap gap-2">{p.tag_ids.map((t) => interestById(t) && <Pill key={t} interest={interestById(t)} selected small />)}</div>
            </div>
          )}
          {p.bio && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: dark ? '#fff' : '#0F0F13' }}>О себе</h3>
              <div className="rounded-3xl p-4" style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f0f1f5'}` }}>
                <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap break-words" style={{ color: dark ? '#ddd' : '#374151' }}>{p.bio}</p>
              </div>
            </div>
          )}
          {p.prompts && Object.values(p.prompts).some((v) => (v || '').trim()) && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: dark ? '#fff' : '#0F0F13' }}>Подробнее</h3>
              <PromptsView prompts={p.prompts} dark={dark} />
            </div>
          )}
        </div>
      </div>

      {/* action bar */}
      {(onLike || onMessage) && (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-5 pt-3 flex items-center justify-center gap-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.04) 40%)' }}>
          {onMessage && <button onClick={() => onMessage(p)} className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-90 transition"><i className="ph-fill ph-chat-circle text-[24px]" style={{ color: '#3B82F6' }} /></button>}
          {onLike && <button onClick={() => { haptic('medium'); onLike(p) }} className="flex-1 max-w-[220px] h-14 rounded-full flex items-center justify-center gap-2 text-white font-bold shadow-lg active:scale-95 transition" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)', boxShadow: '0 10px 30px -8px rgba(255,0,255,0.6)' }}><i className="ph-fill ph-heart text-[22px]" /> Лайк</button>}
        </div>
      )}
    </div>
  )
}
