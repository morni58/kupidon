import { useState, useEffect, useRef } from 'react'
import { MeshBG, VIBES, Grain, hexA } from '../design/fx'
import { Photo, Pill, VerifiedTick, Button } from '../design/ui'
import { gradPhoto, interestById } from '../design/data'
import { api, mediaUrl, haptic, openInvoice } from '../lib/api'
import { SkeletonProfile } from '../design/loaders'
import { AnthemPlayer, PromptsView } from './ProfileExtras'
import { GodBadge, GodNameplate } from '../design/GodBadge'

const PLAN_BADGE = { premium: 'Premium 💎', kupidon: 'Kupidon 👑' }

// Read-only profile of another person, opened from a feed card / likes / chat.
export function UserProfile({ userId, palette, accent = '#FF00FF', dark = false, onBack, onLike, onMessage, setToast }) {
  const [p, setP] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [err, setErr] = useState(false)
  const [scout, setScout] = useState(false)

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
          {p.role === 'god' ? (
            <div className="absolute inset-x-3 bottom-3 z-20">
              <GodNameplate name={p.name} age={p.age} city={p.city_name} verified={p.is_verified} />
              {p.anthem_url && <div className="absolute right-4 bottom-3.5"><AnthemPlayer url={p.anthem_url} title={p.anthem_title} start={p.anthem_start} accent="#FFD700" /></div>}
              {p.likes_me && <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,180,0,0.25)', color: '#FFD700' }}><i className="ph-fill ph-heart" /> Уже лайкнул(а) тебя</div>}
            </div>
          ) : (
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
          )}
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

          {/* Scout: peek at this person's stats (paid / Kupidon perk) */}
          <button onClick={() => { haptic('light'); setScout(true) }} className="w-full rounded-3xl p-4 flex items-center gap-3 active:scale-[0.99] transition" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(236,72,153,0.14))', border: '1px solid rgba(168,85,247,0.3)' }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[22px] shrink-0" style={{ background: 'linear-gradient(135deg,#A855F7,#EC4899)' }}>🕵️</div>
            <div className="text-left min-w-0">
              <div className="text-[14.5px] font-black" style={{ color: dark ? '#fff' : '#0F0F13' }}>Разведка профиля</div>
              <div className="text-[12px] font-medium" style={{ color: dark ? 'rgba(255,255,255,0.65)' : '#6b7280' }}>Активность, мэтч-рейт и анти-тролль сигналы</div>
            </div>
            <i className="ph-bold ph-caret-right ml-auto text-[16px]" style={{ color: '#A855F7' }} />
          </button>
        </div>
      </div>

      {scout && <StatsScout userId={userId} name={p.name} onClose={() => setScout(false)} setToast={setToast} />}

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

// Bottom sheet: scout another person's stats. Locked → paywall (Stars / Kupidon).
function StatsScout({ userId, name, onClose, setToast }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  const [buying, setBuying] = useState(false)

  const load = () => { setData(null); setErr(false); api.userStats(userId).then(setData).catch(() => setErr(true)) }
  useEffect(() => { load() }, [userId])

  async function unlock() {
    if (!data?.product) return
    setBuying(true)
    try {
      const inv = await api.createInvoice(data.product)
      if (!inv.invoice_link) throw new Error('no link')
      const status = await openInvoice(inv.invoice_link)
      if (status === 'paid') { setToast?.('🕵️ Доступ открыт!'); setTimeout(load, 1200) }
      else if (status === 'cancelled') setToast?.('Оплата отменена')
    } catch { setToast?.('Не удалось открыть оплату') }
    setBuying(false)
  }

  const S = data?.stats
  const ROWS = S ? [
    ['ph-heart', 'Лайков отправлено', S.likes_given],
    ['ph-sparkle', 'Лайков получено', S.likes_received],
    ['ph-fire', 'Мэтчей', S.matches],
    ['ph-target', 'Мэтч-рейт', `${S.match_rate}%`],
    ['ph-eye', 'Просмотров профиля', S.views_received],
    ['ph-lightning', 'Серия дней', S.streak_days],
    ['ph-calendar-heart', 'Дней с нами', S.days_with_us],
    ['ph-gauge', 'Рейтинг анкеты', `${S.profile_score}/100`],
  ] : []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose} style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-[2rem] p-5 pb-8 animate-[slideUp_.25s_ease]" style={{ background: '#120C1C', border: '1px solid rgba(168,85,247,0.3)', maxHeight: '82vh', overflowY: 'auto' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[22px]">🕵️</span>
          <h2 className="text-[19px] font-black text-white">Разведка{name ? ` · ${name}` : ''}</h2>
        </div>

        {err && <p className="text-center text-[14px] text-white/70 py-8">Статистика недоступна.</p>}
        {!data && !err && <div className="py-10 flex justify-center"><div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" /></div>}

        {data?.locked && (
          <div className="text-center">
            <div className="text-[64px]">🔒</div>
            <p className="text-[15px] font-semibold text-white mt-2 px-2">Открой активность, мэтч-рейт и анти-тролль сигналы этого человека до того, как лайкнуть.</p>
            <div className="mt-5 space-y-2">
              <Button disabled={buying} onClick={unlock} style={{ background: 'linear-gradient(135deg,#A855F7,#EC4899)', color: '#fff' }}>{buying ? 'Открываем…' : `⭐ Открыть за ${data.price_stars} Stars`}</Button>
              <p className="text-[12px] text-white/55">или бесплатно с подпиской <span className="font-bold text-[#FFD36B]">Kupidon 👑</span> — смотри статистику кого угодно</p>
            </div>
          </div>
        )}

        {data && !data.locked && S && (
          <>
            {data.via_subscription && <div className="mb-3 text-[11px] font-bold inline-flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#FFE259,#FFA751)', color: '#0F0F13' }}>👑 Доступ по подписке Kupidon</div>}
            <div className="grid grid-cols-2 gap-2.5">
              {ROWS.map(([ic, label, val], i) => (
                <div key={i} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <i className={'ph-fill ' + ic + ' text-[16px]'} style={{ color: '#C084FC' }} />
                  <div className="text-[20px] font-black text-white mt-1 leading-none">{val}</div>
                  <div className="text-[11px] font-medium text-white/55 mt-1">{label}</div>
                </div>
              ))}
            </div>
            {/* Anti-troll signals */}
            <div className="mt-3 rounded-2xl p-3.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-[12.5px] font-black text-white mb-2 flex items-center gap-1.5"><i className="ph-fill ph-shield-warning text-[#F87171]" /> Анти-тролль</div>
              <div className="flex gap-2">
                <div className="flex-1 text-center rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-[18px] font-black text-white">{S.city_changes ?? 0}</div>
                  <div className="text-[10.5px] text-white/55">смен города</div>
                </div>
                <div className="flex-1 text-center rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-[18px] font-black text-white">{S.gender_changes ?? 0}</div>
                  <div className="text-[10.5px] text-white/55">смен пола</div>
                </div>
              </div>
              {((S.city_changes ?? 0) + (S.gender_changes ?? 0)) >= 4 && <p className="text-[11px] text-[#F87171] font-semibold mt-2 text-center">⚠️ Часто меняет данные — будь осторожнее</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
