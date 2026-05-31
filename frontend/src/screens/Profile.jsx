import { useState, useEffect, useRef } from 'react'
import { MeshBG, THEME_MESH, VIBES, VIBE_LIST, ScoreRing, Equalizer, Grain, hexA } from '../design/fx'
import { Photo, Button, Toggle, Pill, VerifiedTick, TabBar, Confetti } from '../design/ui'
import { ageFromBirth, gradPhoto, interestById } from '../design/data'
import { api, haptic, openInvoice } from '../lib/api'

function Glass({ children, className = '', dark = false, style = {} }) {
  return (
    <div className={'rounded-3xl ' + className}
      style={{ background: dark ? 'rgba(26,26,29,0.72)' : 'rgba(255,255,255,0.72)', border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px) saturate(1.2)', boxShadow: dark ? '0 8px 30px -16px rgba(0,0,0,0.6)' : '0 10px 30px -18px rgba(0,0,0,0.18)', ...style }}>
      {children}
    </div>
  )
}

const PLAN_BADGE = { free: 'Free', premium: 'Premium 💎', kupidon: 'Kupidon 👑' }
function PlanTag({ tier }) {
  const map = { free: { bg: 'rgba(255,255,255,0.25)', fg: '#fff' }, premium: { bg: 'rgba(255,0,255,0.9)', fg: '#fff' }, kupidon: { bg: 'linear-gradient(135deg,#FFE259,#FFA751)', fg: '#0F0F13' } }
  const m = map[tier] || map.free
  return <span className="inline-flex items-center rounded-full font-bold" style={{ background: m.bg, color: m.fg, fontSize: 11.5, padding: '3px 10px', backdropFilter: 'blur(6px)' }}>{PLAN_BADGE[tier]}</span>
}

function AnimNum({ value, className, style }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf, start; const dur = 800
    const step = (t) => { if (!start) start = t; const k = Math.min(1, (t - start) / dur); setN(Math.round(value * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={className} style={style}>{n}</span>
}

export function Profile({ theme, plan, prefs, setPref, onVerify, onUpgrade, onMutate, setToast, active, onTab, dots }) {
  const [full, setFull] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const scrollRef = useRef(null)

  const load = () => api.getMeFull().then(setFull).catch(() => {})
  useEffect(() => { load() }, [])

  if (!full) return <div className="w-full h-full flex items-center justify-center" style={{ background: '#FAFAFC' }}><div className="w-12 h-12 rounded-2xl bg-black/5 animate-pulse" /></div>

  const dark = theme === 'oligarch' || theme === 'adult'
  const themeAccent = theme === 'oligarch' ? '#FFD700' : theme === 'adult' ? '#FF3333' : null
  const vibe = VIBES[prefs.vibe] || VIBES.neon
  const accent = themeAccent || vibe.accent
  const palette = theme === 'light' ? vibe : THEME_MESH[theme]
  const verified = full.is_verified
  const age = ageFromBirth(full.birth_date)
  const photos = (full.media && full.media.length ? full.media.map((url) => ({ url })) : [gradPhoto((full.name || '?').charCodeAt(0), '😎')])

  let score = full.profile_score || 0
  const txt = dark ? '#fff' : '#0F0F13'
  const sub = theme === 'adult' ? '#ff9999' : dark ? '#9ca3af' : '#6b7280'
  const frameGlow = prefs.frame === 'glow'

  async function toggle(field, value, guard) {
    if (guard) { const msg = guard(value); if (msg) { setToast(msg); return } }
    try {
      await api.updateProfile({ [field]: value })
      await load(); onMutate?.()
      haptic('light')
    } catch (e) { setToast(e?.data?.detail || 'Не удалось') }
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette} />
      <div ref={scrollRef} onScroll={(e) => setScrollY(e.target.scrollTop)} className="relative z-10 w-full h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)' }}>
        {/* cover carousel */}
        <div className="relative" style={{ height: 440 }}>
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '0 0 2rem 2rem', transform: `translateY(${scrollY * 0.3}px) scale(${1 + scrollY * 0.0004})`, transformOrigin: 'top' }}>
            <Photo data={photos[photoIdx]} rounded="0 0 2rem 2rem" className="w-full h-full" emojiSize={172} />
            <Grain opacity={0.08} blend="overlay" />
          </div>
          {frameGlow && <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: 440, borderRadius: '0 0 2rem 2rem', boxShadow: `inset 0 0 80px ${hexA(accent, 0.45)}, inset 0 -2px 0 ${hexA(accent, 0.5)}` }} />}
          <div className="absolute top-3 left-3 right-3 flex gap-1.5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {photos.map((_, i) => <div key={i} className="flex-1 rounded-full" style={{ height: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: i === photoIdx ? '0 0 8px #fff' : 'none' }} />)}
          </div>
          <div className="absolute left-0 top-20 bottom-24 w-1/2" onClick={() => setPhotoIdx((p) => Math.max(0, p - 1))} />
          <div className="absolute right-0 top-20 bottom-24 w-1/2" onClick={() => setPhotoIdx((p) => Math.min(photos.length - 1, p + 1))} />
          <div className="absolute inset-x-3 bottom-3 rounded-[1.5rem] px-4 py-3.5 overflow-hidden" style={{ background: 'rgba(16,12,22,0.36)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[28px] font-black text-white leading-none tracking-tight">{full.name}, {age}</h1>
              {verified && <VerifiedTick size={22} />}
              <span className="ml-auto"><PlanTag tier={full.tier} /></span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[12.5px] font-semibold flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.8)' }}><i className="ph-fill ph-map-pin" style={{ color: accent }} /> {full.city_name || 'Рядом'}</p>
              {prefs.anthem && <div className="flex items-center gap-2"><Equalizer color="#fff" bars={4} height={14} /><span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>Мой гимн</span></div>}
            </div>
          </div>
        </div>

        <div className="screen-pad pt-4 space-y-3">
          <Glass dark={dark} className="p-4">
            <div className="flex items-center gap-4">
              <ScoreRing value={score} size={88} color={accent} track={dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'} />
              <div className="flex-1">
                <div className="text-[15px] font-black" style={{ color: txt }}>Привлекательность анкеты</div>
                <p className="mt-1 text-[12px] font-medium" style={{ color: sub }}>Добавь видео и пройди верификацию для 100%</p>
              </div>
            </div>
          </Glass>

          {/* customization */}
          <Glass dark={dark} className="p-4">
            <div className="flex items-center gap-2 mb-3"><i className="ph-fill ph-palette" style={{ color: accent }} /><span className="text-[14px] font-black" style={{ color: txt }}>Оформление профиля</span></div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: sub }}>Вайб</div>
            <div className="flex gap-2.5 mb-4">
              {VIBE_LIST.map((v) => (
                <button key={v.id} onClick={() => setPref({ vibe: v.id })} className="relative rounded-full transition active:scale-90 shrink-0" style={{ width: 38, height: 38 }}>
                  <span className="block w-full h-full rounded-full" style={{ background: `linear-gradient(135deg, ${v.blobs[0][0]}, ${v.blobs[1][0]})`, boxShadow: prefs.vibe === v.id ? `0 0 0 2px ${dark ? '#141416' : '#fff'}, 0 0 0 4px ${v.accent}` : 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
                  {prefs.vibe === v.id && <i className="ph-bold ph-check absolute inset-0 flex items-center justify-center text-white text-[15px]" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2"><i className="ph-fill ph-sparkle text-[16px]" style={{ color: accent }} /><span className="text-[13.5px] font-semibold" style={{ color: txt }}>Свечение рамки фото</span></div>
              <Toggle on={prefs.frame === 'glow'} color={accent} onChange={(v) => setPref({ frame: v ? 'glow' : 'flat' })} />
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2"><i className="ph-fill ph-music-notes text-[16px]" style={{ color: accent }} /><span className="text-[13.5px] font-semibold" style={{ color: txt }}>Музыкальный гимн</span></div>
              <Toggle on={prefs.anthem} color={accent} onChange={(v) => setPref({ anthem: v })} />
            </div>
          </Glass>

          {/* streak */}
          <Glass dark={dark} className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[24px]" style={{ background: hexA('#FF7849', 0.16) }}>🔥</div>
            <div className="flex-1"><div className="text-[16px] font-black" style={{ color: txt }}>{full.streak_days} дней подряд</div><div className="text-[12px] font-medium" style={{ color: sub }}>Заходи каждый день за наградами</div></div>
          </Glass>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            {[[full.swipes_left, 'свайпов'], [full.superlikes_left, 'суперлайков'], [0, 'смотрели', true]].map(([n, l, clk], i) => (
              <Glass key={i} dark={dark} className="p-3 text-center">
                <AnimNum value={n} className="text-[22px] font-black block" style={{ color: accent }} />
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: sub }}>{l}</div>
              </Glass>
            ))}
          </div>

          {/* verification CTA */}
          {!verified && (
            <div className="rounded-3xl p-4 flex items-center gap-3 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.16), rgba(99,102,241,0.16))', border: '1px solid rgba(59,130,246,0.35)' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-[22px] shrink-0" style={{ background: 'rgba(59,130,246,0.2)' }}>🔵</div>
              <div className="flex-1 min-w-0"><div className="text-[15px] font-bold" style={{ color: txt }}>Получи синюю галочку</div><div className="text-[12px] font-medium" style={{ color: sub }}>+15 к анкете, фильтр Verified</div></div>
              <Button variant="blue" size="sm" onClick={onVerify}>Верифицировать</Button>
            </div>
          )}

          {/* interests */}
          {full.tag_ids?.length > 0 && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: txt }}>Интересы</h3>
              <div className="flex flex-wrap gap-2">{full.tag_ids.map((t) => interestById(t) && <Pill key={t} interest={interestById(t)} selected small />)}</div>
            </div>
          )}

          {/* about */}
          {full.bio && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: txt }}>О себе</h3>
              <Glass dark={dark} className="p-4"><p className="text-[14px] font-medium leading-relaxed" style={{ color: dark ? '#ddd' : '#374151' }}>{full.bio}</p></Glass>
            </div>
          )}

          {/* toggles */}
          <Glass dark={dark} className="p-1 divide-y" style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-3 p-3.5">
              <span className="text-[22px]">🔞</span>
              <div className="flex-1"><div className="text-[15px] font-bold" style={{ color: txt }}>Комната 18+</div><div className="text-[12px] font-medium" style={{ color: sub }}>Только для verified</div></div>
              <Toggle on={full.is_18_mode_active} color="#FF3333" onChange={(v) => toggle('is_18_mode_active', v, (val) => val && !verified ? '🔵 Сначала пройди верификацию' : null)} />
            </div>
            {full.gender === 'female' && (
              <div className="flex items-center gap-3 p-3.5">
                <span className="text-[22px]">🛡️</span>
                <div className="flex-1"><div className="text-[15px] font-bold" style={{ color: txt }}>Анти-Олигарх щит</div><div className="text-[12px] font-medium" style={{ color: sub }}>Бесплатно ♀ · невидимость для VIP</div></div>
                <Toggle on={full.is_anti_oligarch} color="#10B981" onChange={(v) => toggle('is_anti_oligarch', v)} />
              </div>
            )}
          </Glass>

          {/* oligarch panel */}
          {full.is_oligarch_mode && (
            <div className="rounded-3xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#1c1708,#0c0c0c)', border: '1px solid rgba(255,215,0,0.4)', boxShadow: '0 10px 34px -12px rgba(255,215,0,0.3)' }}>
              <div className="flex items-center gap-2 mb-3 relative"><span className="text-[20px]">👑</span><span className="text-[16px] font-black" style={{ color: '#FFD700' }}>Режим Олигарх</span></div>
              <div className="flex items-center gap-3 mb-3 relative">
                <span className="text-[20px]">🕵️</span>
                <div className="flex-1"><div className="text-[14px] font-bold text-white">Стелс-режим</div><div className="text-[11px]" style={{ color: '#9a8a5a' }}>Невидим в общей ленте</div></div>
                <Toggle on={full.is_stealth_mode} color="#FFD700" onChange={(v) => toggle('is_stealth_mode', v)} />
              </div>
              <div className="rounded-2xl px-3 py-2.5 flex items-center justify-between relative" style={{ background: 'rgba(255,215,0,0.08)' }}>
                <span className="text-[12px] font-semibold" style={{ color: '#c9b870' }}>VIP-сигналов сегодня</span>
                <span className="text-[14px] font-black" style={{ color: '#FFD700' }}>{full.vip_signals_used} / 20</span>
              </div>
            </div>
          )}

          {/* upgrade CTA */}
          {full.tier === 'free' && (
            <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)', boxShadow: '0 16px 40px -16px rgba(255,0,255,0.6)' }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <Grain opacity={0.1} blend="soft-light" />
              <div className="relative">
                <div className="text-[20px] font-black text-white">Стань Купидоном 💘</div>
                <div className="text-[13px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.92)' }}>500 свайпов, режим Олигарх, 15 врывов</div>
                <button onClick={onUpgrade} className="mt-3 h-11 px-5 rounded-2xl bg-white font-bold text-[14px] text-[#FF00FF] active:scale-95 transition">Открыть тарифы</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <TabBar active={active} onTab={onTab} accent={accent} dark={dark} dots={dots} />
    </div>
  )
}

/* ---------------- VERIFICATION ---------------- */
const GESTURES = ['Коснись щеки 👆', 'Повернись влево ←', 'Улыбнись 😊', 'Подними руку ✋']
export function Verification({ onBack, onSuccess, setToast }) {
  const [phase, setPhase] = useState('intro')
  const [gesture] = useState(GESTURES[Math.floor(Math.random() * GESTURES.length)])
  async function start() {
    setPhase('rec')
    await new Promise((r) => setTimeout(r, 2200))
    try { await api.verifySelfie(); haptic('success'); setPhase('ok') }
    catch { setPhase('err') }
  }
  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'linear-gradient(180deg,#EFF6FF,#FAFAFC)' }}>
      <div className="safe-top screen-pad shrink-0 pt-1">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center active:scale-90 transition"><i className="ph-bold ph-arrow-left text-[18px] text-[#0F0F13]" /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center screen-pad">
        {phase === 'intro' && (<>
          <div className="relative flex items-center justify-center mb-7" style={{ width: 200, height: 200 }}>
            <div className="absolute inset-0 rounded-full" style={{ border: '3px dashed #93C5FD' }} />
            <div className="text-[80px]">🤳</div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-full text-[14px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)', boxShadow: '0 8px 20px -6px rgba(59,130,246,0.5)' }}>{gesture}</div>
          </div>
          <h1 className="text-[28px] font-black text-[#0F0F13] tracking-tight">Подтверди, что это ты</h1>
          <p className="mt-2 text-[14px] font-medium text-[#6b7280] px-4">Повтори жест. Кадры не сохраняются — только разовая сверка</p>
          <div className="w-full mt-8"><Button variant="blue" onClick={start}>📷 Начать</Button></div>
          <p className="mt-4 text-[13px] font-bold text-[#3B82F6]">✓ Получишь синюю галочку +15 к анкете</p>
        </>)}
        {phase === 'rec' && (<>
          <div className="relative flex items-center justify-center mb-7" style={{ width: 200, height: 200 }}>
            <div className="absolute inset-0 rounded-full" style={{ border: '3px solid #3B82F6', animation: 'pulseRing 1.5s infinite' }} />
            <div className="text-[80px]">🤳</div>
            <div className="absolute top-4 right-6 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" /><span className="text-[11px] font-bold text-[#EF4444]">REC</span>
            </div>
          </div>
          <h1 className="text-[24px] font-black text-[#0F0F13]">Идёт проверка…</h1>
          <p className="mt-2 text-[14px] font-medium text-[#6b7280]">{gesture}</p>
        </>)}
        {phase === 'ok' && (
          <div className="anim-pop"><Confetti />
            <div className="text-[88px]">✅</div>
            <h1 className="text-[30px] font-black text-[#0F0F13] mt-2">Верифицирован!</h1>
            <p className="mt-2 text-[15px] font-medium text-[#6b7280]">Синяя галочка добавлена</p>
            <div className="w-full mt-8"><Button variant="blue" onClick={onSuccess}>В профиль</Button></div>
          </div>
        )}
        {phase === 'err' && (
          <div className="anim-pop">
            <div className="text-[88px]">❌</div>
            <h1 className="text-[28px] font-black text-[#0F0F13] mt-2">Не удалось</h1>
            <p className="mt-2 text-[15px] font-medium text-[#6b7280]">Попробуй снова</p>
            <div className="w-full mt-8"><Button variant="blue" onClick={() => setPhase('intro')}>Повторить</Button></div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- PRICING ---------------- */
const TIERS = [
  { id: 'free', name: 'Free', emoji: '', accent: '#9ca3af', badge: null, product: null, rows: ['50 свайпов/день', '0 суперлайков', 'Врыв за ⭐', '15 смс до TG', 'Без отката', 'Кто смотрел — силуэт'] },
  { id: 'premium', name: 'Premium', emoji: '💎', accent: '#FF00FF', badge: 'Выбор 80%', product: 'premium_month', rows: ['200 свайпов/день', '5 суперлайков/день', '3 врыва/день', '5 смс до TG', 'Откат свайпа ✓', 'Кто смотрел — открыто'] },
  { id: 'kupidon', name: 'Kupidon', emoji: '👑', accent: '#FFD700', badge: 'VIP', product: 'kupidon_month', rows: ['500 свайпов/день', '5+ суперлайков', '15 врывов/день', 'TG сразу', 'Откат свайпа ✓', 'Режим Олигарх ✓'] },
]
const STARS = [
  { label: 'Написать без мэтча', price: 50, emoji: '💌', product: 'force_chat' },
  { label: 'Буст анкеты 2 часа', price: 100, emoji: '🚀', product: 'boost' },
  { label: 'Разовый суперлайк', price: 150, emoji: '⭐', product: 'superlike' },
  { label: 'VIP-сигнал (Олигарх)', price: 500, emoji: '👑', product: 'vip_signal' },
]
export function Pricing({ onBack, currentTier, setToast, onMutate }) {
  async function buy(product) {
    if (!product) return
    try {
      const res = await api.createInvoice(product)
      if (res.invoice_link) { const st = await openInvoice(res.invoice_link); if (st === 'paid') { setToast('✅ Оплата прошла!'); onMutate?.() } }
      else setToast(`Счёт на ${res.stars} ⭐ создан`)
    } catch { setToast('Ошибка платежа') }
  }
  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={VIBES.berry} grainOpacity={0.05} />
      <div className="relative z-10 w-full h-full overflow-y-auto noscroll">
        <div className="safe-top screen-pad pb-8">
          <div className="flex items-center gap-3 pt-1 pb-3">
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-white/60 flex items-center justify-center active:scale-90 transition shrink-0"><i className="ph-bold ph-x text-[18px] text-[#0F0F13]" /></button>
            <h1 className="text-[24px] font-black tracking-tight text-[#0F0F13]">Стань Купидоном 💘</h1>
          </div>
          <div className="space-y-3">
            {TIERS.map((t) => {
              const isK = t.id === 'kupidon', isP = t.id === 'premium', current = currentTier === t.id
              return (
                <div key={t.id} className="rounded-3xl p-4 relative overflow-hidden" style={{ background: isK ? 'linear-gradient(150deg,#1a1505,#0d0d0d)' : '#fff', border: isP ? '2px solid #FF00FF' : isK ? '1.5px solid rgba(255,215,0,0.4)' : '1.5px solid #e5e7eb', boxShadow: isP ? '0 12px 30px -12px rgba(255,0,255,0.3)' : isK ? '0 12px 30px -12px rgba(255,215,0,0.25)' : 'none' }}>
                  {t.badge && <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-black" style={{ background: isK ? 'rgba(255,215,0,0.18)' : 'rgba(255,0,255,0.12)', color: t.accent }}>{t.badge}</span>}
                  <div className="flex items-center gap-2 mb-3"><span className="text-[20px] font-black" style={{ color: isK ? '#FFD700' : '#0F0F13' }}>{t.name}</span><span className="text-[18px]">{t.emoji}</span></div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
                    {t.rows.map((r, i) => <div key={i} className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: isK ? '#cfc6a8' : '#374151' }}><i className="ph-bold ph-check text-[12px]" style={{ color: t.accent }} /> {r}</div>)}
                  </div>
                  {t.id !== 'free' && (current ? (
                    <div className="h-12 rounded-2xl flex items-center justify-center text-[14px] font-bold" style={{ background: isK ? 'rgba(255,215,0,0.1)' : 'rgba(255,0,255,0.08)', color: t.accent }}>Текущий план ✓</div>
                  ) : isK ? (
                    <Button variant="gold" onClick={() => buy(t.product)} className="w-full">Оформить Kupidon</Button>
                  ) : (
                    <Button onClick={() => buy(t.product)} className="w-full">Оформить Premium</Button>
                  ))}
                </div>
              )
            })}
          </div>
          <h2 className="text-[18px] font-black text-[#0F0F13] mt-6 mb-3 px-1">Разовые покупки ⭐</h2>
          <div className="grid grid-cols-2 gap-3">
            {STARS.map((s) => (
              <button key={s.label} onClick={() => buy(s.product)} className="rounded-2xl p-3.5 text-left bg-white border border-[#e5e7eb] active:scale-95 transition">
                <div className="text-[24px] mb-1">{s.emoji}</div>
                <div className="text-[13px] font-bold text-[#0F0F13] leading-tight">{s.label}</div>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-black" style={{ background: 'rgba(255,215,0,0.15)', color: '#B8860B' }}>{s.price} ⭐</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
