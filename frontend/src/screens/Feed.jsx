import { useState, useRef, useEffect } from 'react'
import { MeshBG, THEME_MESH, VIBES, hexA, Grain } from '../design/fx'
import { Photo, Pill, Badge, Button, Sheet, TabBar, Avatar, Confetti } from '../design/ui'
import { apiCardToPerson, gradPhoto } from '../design/data'
import { SkeletonFeed } from '../design/loaders'
import { ArtNoCards } from '../design/illustrations'
import { api, haptic } from '../lib/api'

const INTENTS = [{ label: 'Без обязательств', emoji: '🎲' }, { label: 'Один вечер', emoji: '🌙' }]

function Stamp({ show, text, color, side }) {
  const pos = side === 'l' ? { top: 34, left: 22, transform: 'rotate(-13deg)' }
    : side === 'r' ? { top: 34, right: 22, transform: 'rotate(13deg)' }
    : { bottom: 150, left: '50%', transform: 'translateX(-50%) rotate(-6deg)' }
  return (
    <div className="absolute z-30 px-4 py-2 rounded-2xl font-black text-[22px] tracking-wide whitespace-nowrap"
      style={{ ...pos, color: '#fff', background: hexA(color, 0.22), border: `2.5px solid ${color}`, backdropFilter: 'blur(4px)',
        boxShadow: `0 0 30px ${hexA(color, 0.7)}, inset 0 0 18px ${hexA(color, 0.4)}`, opacity: show, transition: 'opacity .08s' }}>{text}</div>
  )
}

function ProfileCard({ person, theme, front, drag = { x: 0, y: 0 }, photoIdx = 0, onTapPhoto, dragging, onOpenProfile }) {
  const adult = theme === 'adult'
  const ph = person.photos[photoIdx] || person.photos[0]
  const dx = drag.x, dy = drag.y
  const likeOn = dx > 30 ? Math.min(1, (dx - 20) / 90) : 0
  const nopeOn = dx < -30 ? Math.min(1, (-dx - 20) / 90) : 0
  const supOn = dy < -50 && Math.abs(dx) < 80 ? Math.min(1, (-dy - 40) / 90) : 0
  const par = front ? { x: -dx * 0.06, y: -dy * 0.04 } : { x: 0, y: 0 }
  const glossX = 50 + Math.max(-50, Math.min(50, dx / 3))
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '2rem', boxShadow: theme === 'oligarch' ? '0 30px 70px -18px rgba(255,215,0,0.28)' : adult ? '0 30px 70px -18px rgba(255,45,45,0.3)' : '0 30px 70px -18px rgba(255,0,255,0.28)' }}>
      <div className="absolute inset-0" style={{ transform: `translate(${par.x}px,${par.y}px) scale(1.08)`, transition: dragging ? 'none' : 'transform .4s cubic-bezier(.22,1,.36,1)' }}>
        <Photo data={ph} rounded="0" className="w-full h-full" emojiSize={172} />
        <Grain opacity={0.09} blend="overlay" />
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(130% 90% at 50% 8%, rgba(255,255,255,0.18), transparent 38%), radial-gradient(120% 100% at 50% 100%, rgba(0,0,0,0.35), transparent 55%)' }} />
      {adult && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(160deg, rgba(60,0,0,0.45), rgba(20,0,0,0.6))', mixBlendMode: 'multiply' }} />}
      {theme === 'oligarch' && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(160deg, rgba(40,30,0,0.3), rgba(10,8,0,0.5))', mixBlendMode: 'multiply' }} />}
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '2rem', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16)' }} />
      {front && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.18) ${glossX}%, transparent ${glossX + 12}%)`, opacity: dragging ? 0.9 : 0.45, transition: 'opacity .3s' }} />}
      <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-20">
        {person.photos.map((_, i) => <div key={i} className="flex-1 rounded-full transition-all" style={{ height: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: i === photoIdx ? '0 0 8px rgba(255,255,255,0.8)' : 'none' }} />)}
      </div>
      {front && (<>
        <div className="absolute left-0 top-12 bottom-44 w-1/2 z-10" onClick={(e) => { e.stopPropagation(); onTapPhoto(-1) }} />
        <div className="absolute right-0 top-12 bottom-44 w-1/2 z-10" onClick={(e) => { e.stopPropagation(); onTapPhoto(1) }} />
      </>)}
      {person.verified && <div className="absolute top-7 right-3 z-20"><Badge kind="glass"><i className="ph-fill ph-seal-check" style={{ color: '#60A5FA' }} /> Verified</Badge></div>}
      {front && (<>
        <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(120% 80% at 110% 50%, rgba(16,185,129,0.55), transparent 55%)', opacity: likeOn }} />
        <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(120% 80% at -10% 50%, rgba(239,68,68,0.55), transparent 55%)', opacity: nopeOn }} />
        <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(100% 90% at 50% -10%, rgba(168,85,247,0.6), transparent 55%)', opacity: supOn }} />
      </>)}
      <div className="absolute inset-x-3 bottom-3 z-20 rounded-[1.6rem] px-4 pt-3.5 pb-4 overflow-hidden"
        style={{ background: adult ? 'rgba(30,4,6,0.4)' : 'rgba(18,14,26,0.34)', backdropFilter: 'blur(18px) saturate(1.2)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 12px 30px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)' }}>
        <div className="flex items-end justify-between gap-2 min-w-0">
          <h2 className="flex-1 min-w-0 truncate text-[26px] font-black text-white leading-none tracking-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.4)' }}>{person.name}, {person.age}</h2>
          {front && onOpenProfile && (
            <button onClick={(e) => { e.stopPropagation(); onOpenProfile(person.id) }} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <i className="ph-bold ph-info text-white text-[17px]" />
            </button>
          )}
          {person.dist && <span className="flex items-center gap-1 text-[12px] font-semibold mb-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }}><i className="ph-fill ph-map-pin" style={{ color: adult ? '#FF6B6B' : '#FF99DD' }} />{person.dist}</span>}
        </div>
        <p className="mt-1 text-[12px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{person.city}</p>
        <div className="mt-2.5 flex gap-1.5 items-center overflow-hidden" style={{ maxHeight: 30 }}>
          {(adult ? INTENTS : person.tags.slice(0, 3)).map((t, i) => adult ? (
            <span key={i} className="inline-flex items-center gap-1 rounded-full font-semibold text-white" style={{ height: 28, padding: '0 11px', fontSize: 11.5, background: 'rgba(255,45,45,0.22)', border: '1px solid rgba(255,80,80,0.6)' }}>{t.emoji} {t.label}</span>
          ) : (<Pill key={i} interest={t} glass small />))}
          {!adult && person.common > 0 && <Badge kind="common"><i className="ph-fill ph-check-circle" /> {person.common} общих</Badge>}
        </div>
        {adult && <p className="mt-2.5 text-[11px] font-semibold flex items-center gap-1" style={{ color: '#ff9999' }}><i className="ph-fill ph-shield-check" /> Эротика заблокирована системой</p>}
      </div>
      {front && (<>
        <Stamp show={likeOn} text="ЛАЙК ❤️" color="#10B981" side="l" />
        <Stamp show={nopeOn} text="НЕТ 👎" color="#EF4444" side="r" />
        <Stamp show={supOn} text="СУПЕРЛАЙК ⭐" color="#A855F7" side="t" />
      </>)}
    </div>
  )
}

function SwipeCard({ person, theme, onDecide, photoIdx, onTapPhoto, fling, onOpenProfile }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(null)
  const start = useRef(null)
  useEffect(() => { if (fling && fling.id === person.id) doFling(fling.dir) }, [fling])
  const down = (e) => { setDragging(true); start.current = { x: e.touches ? e.touches[0].clientX : e.clientX, y: e.touches ? e.touches[0].clientY : e.clientY } }
  const move = (e) => { if (!start.current) return; const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; setDrag({ x: cx - start.current.x, y: cy - start.current.y }) }
  const up = () => {
    if (!start.current) return
    start.current = null; setDragging(false)
    const { x, y } = drag
    if (x > 110) doFling('like'); else if (x < -110) doFling('nope'); else if (y < -120 && Math.abs(x) < 100) doFling('super'); else setDrag({ x: 0, y: 0 })
  }
  const doFling = (dir) => {
    const target = dir === 'like' ? { x: 640, y: 30 } : dir === 'nope' ? { x: -640, y: 30 } : { x: 0, y: -780 }
    setLeaving(target); setTimeout(() => onDecide(dir), 320)
  }
  const pos = leaving || drag
  const rot = pos.x / 16
  return (
    <div className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg)`, transition: leaving ? 'transform .34s cubic-bezier(.4,0,.2,1)' : !dragging ? 'transform .42s cubic-bezier(.34,1.4,.5,1)' : 'none' }}
      onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up} onTouchStart={down} onTouchMove={move} onTouchEnd={up}>
      <ProfileCard person={person} theme={theme} front drag={drag} dragging={dragging} photoIdx={photoIdx} onTapPhoto={onTapPhoto} onOpenProfile={onOpenProfile} />
    </div>
  )
}

function ActionBar({ theme, plan, superLeft, canRewind, onAction }) {
  const adult = theme === 'adult'
  const likeBg = adult ? 'linear-gradient(135deg,#FF3333,#FF00FF)' : theme === 'oligarch' ? 'linear-gradient(135deg,#FFE259,#FFA751)' : 'linear-gradient(135deg,#FF00FF,#FF66CC)'
  const likeGlow = adult ? '0 0 30px rgba(255,51,51,0.6)' : theme === 'oligarch' ? '0 0 30px rgba(255,168,81,0.6)' : '0 0 30px rgba(255,0,255,0.6)'
  const Round = ({ size, bg, children, onClick, glow, badge, ring }) => (
    <button onClick={onClick} className="relative rounded-full flex items-center justify-center active:scale-90 transition shrink-0"
      style={{ width: size, height: size, background: bg, boxShadow: glow || '0 10px 24px rgba(0,0,0,0.14)', border: ring ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
      {children}
      {badge != null && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#A855F7', boxShadow: '0 0 0 2px #fff' }}>{badge}</span>}
    </button>
  )
  return (
    <div className="flex items-center justify-center gap-3.5">
      <div className="relative">
        <Round size={46} bg="rgba(255,255,255,0.92)" ring onClick={() => onAction('rewind')}><i className="ph-fill ph-arrow-counter-clockwise text-[20px]" style={{ color: '#F59E0B' }} /></Round>
        {!canRewind && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white/70 whitespace-nowrap flex items-center gap-0.5"><i className="ph-fill ph-lock-simple" />Premium</span>}
      </div>
      <Round size={60} bg="rgba(255,255,255,0.95)" ring onClick={() => onAction('nope')}><i className="ph-bold ph-x text-[28px] text-[#0F0F13]" /></Round>
      <Round size={60} bg={likeBg} glow={likeGlow} onClick={() => onAction('like')}><i className="ph-fill ph-heart text-[30px] text-white" /></Round>
      <Round size={46} bg="rgba(255,255,255,0.92)" ring badge={plan.superlikes > 0 ? superLeft : null} onClick={() => onAction('super')}><i className="ph-fill ph-star text-[20px]" style={{ color: '#A855F7' }} /></Round>
    </div>
  )
}

function MatchModal({ person, theme, me, onWrite, onContinue }) {
  const myAvatar = (me?.media && me.media[0]) ? { url: me.media[0] } : gradPhoto((me?.name || '🙂').charCodeAt(0), '😍')
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8 anim-pop overflow-hidden">
      <MeshBG palette={THEME_MESH[theme] || VIBES.berry} grainOpacity={0.12} />
      <div className="absolute inset-0" style={{ background: 'rgba(8,4,12,0.66)' }} />
      <Confetti />
      <div className="relative flex items-center justify-center mb-7" style={{ height: 124 }}>
        <div className="floaty"><Avatar data={myAvatar} size={108} ring /></div>
        <div className="floaty" style={{ marginLeft: -30, animationDelay: '.6s' }}><Avatar data={person.photos[0]} size={108} ring /></div>
      </div>
      <div className="relative text-[48px] anim-pop">💕</div>
      <h2 className="relative text-[36px] font-black text-white tracking-tight mt-1" style={{ textShadow: '0 0 30px rgba(255,0,255,0.6)' }}>Совпадение!</h2>
      <p className="relative mt-2 text-[16px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.78)' }}>Вы понравились друг другу</p>
      <div className="relative w-full mt-8 space-y-3">
        <Button onClick={onWrite}>💬 Написать первым</Button>
        <Button variant="ghost" onClick={onContinue} className="w-full" style={{ color: 'rgba(255,255,255,0.78)' }}>Продолжить свайпать</Button>
      </div>
    </div>
  )
}

function Paywall({ open, onClose, onUpgrade }) {
  const [t, setT] = useState('00:00:00')
  useEffect(() => {
    if (!open) return
    // Real countdown to the next 00:00 Moscow time (UTC+3).
    const secsToMskMidnight = () => {
      const now = new Date()
      const msk = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000)
      const next = new Date(msk); next.setHours(24, 0, 0, 0)
      return Math.max(0, Math.floor((next - msk) / 1000))
    }
    const tick = () => {
      let s = secsToMskMidnight()
      const h = String(Math.floor(s / 3600)).padStart(2, '0')
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
      const ss = String(s % 60).padStart(2, '0')
      setT(`${h}:${m}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [open])
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="text-center mb-1">
        <div className="text-[40px] floaty">🔓</div>
        <h2 className="text-[24px] font-black text-[#0F0F13] mt-1">Открой CupidBot</h2>
        <p className="text-[14px] font-medium text-[#6b7280] mt-1">Свайпы на сегодня закончились</p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-[#FAFAFC] border border-[#e5e7eb]">
          <i className="ph-fill ph-clock text-[#6b7280]" /><span className="text-[13px] font-bold text-[#0F0F13] tabular-nums">Обновятся через {t}</span>
        </div>
        <p className="text-[11px] text-[#9ca3af] mt-1">в 00:00 МСК</p>
      </div>
      <div className="space-y-3 mt-5">
        <Button onClick={() => onUpgrade('premium_month')}>💎 Premium — 200 свайпов/день</Button>
        <Button variant="gold" onClick={() => onUpgrade('kupidon_month')}>👑 Kupidon VIP — 500 + Олигарх</Button>
        <Button variant="ghost" onClick={onClose} className="w-full">Остаться на Free</Button>
      </div>
    </Sheet>
  )
}

const DIR_MAP = { like: 'right', nope: 'left', super: 'superlike' }

export function Feed({ theme, palette, accent: accentProp, dark, plan, me, refreshMe, onMatch, onUpgrade, setToast, dots, active, onTab, onOpenProfile }) {
  const adult = theme === 'adult'
  const [deck, setDeck] = useState([])
  const [idx, setIdx] = useState(0)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [superLeft, setSuperLeft] = useState(me?.superlikes_left || 0)
  const [swipesLeft, setSwipesLeft] = useState(me?.swipes_left ?? 50)
  const [match, setMatch] = useState(null)
  const [paywall, setPaywall] = useState(false)
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [bump, setBump] = useState(0)
  const [fling, setFling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState([])
  const [filterTags, setFilterTags] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [tempFilter, setTempFilter] = useState([])
  const openFilter = () => { setTempFilter(filterTags); setFilterOpen(true) }
  const toggleTemp = (id) => setTempFilter((t) => t.includes(id) ? t.filter((x) => x !== id) : [...t, id])

  useEffect(() => { api.getTags().then(setAllTags).catch(() => {}) }, [])

  const accent = accentProp || (adult ? '#FF3333' : theme === 'oligarch' ? '#FFD700' : '#FF00FF')

  async function loadFeed(useCache = false) {
    // Instant render from the prefetched cache (boot warm-up), then refresh silently.
    if (useCache && !onlyVerified && !filterTags) {
      const cached = useStore.getState().consumeFeedCache?.()
      if (cached && cached.length) {
        setDeck(cached.map((c) => apiCardToPerson(c)))
        setIdx(0); setLoading(false)
        return
      }
    }
    setLoading(true)
    try {
      const cards = await api.getFeed(onlyVerified, filterTags)
      setDeck(cards.map((c) => apiCardToPerson(c)))
      setIdx(0)
    } catch { setDeck([]) }
    setLoading(false)
  }
  // First load tries the warm cache; filter changes always hit the network.
  const firstLoad = useRef(true)
  useEffect(() => { loadFeed(firstLoad.current); firstLoad.current = false }, [onlyVerified, filterTags])
  useEffect(() => { setSuperLeft(me?.superlikes_left || 0); setSwipesLeft(me?.swipes_left ?? 50) }, [me?.superlikes_left, me?.swipes_left])

  const person = deck[idx]
  const ended = !loading && idx >= deck.length

  // Record a profile view when a new card comes to the front (UX14 / "кто смотрел").
  useEffect(() => { if (person?.id) api.recordView(person.id).catch(() => {}) }, [person?.id])

  async function decide(dir) {
    const p = deck[idx]
    setPhotoIdx(0); setFling(null)
    setIdx((i) => i + 1); setBump((b) => b + 1)
    if (dir === 'super') setSuperLeft((s) => Math.max(0, s - 1))
    setSwipesLeft((s) => Math.max(0, s - 1))
    if (!p) return
    try {
      const res = await api.swipe(p.id, DIR_MAP[dir])
      if (res.is_match) { haptic('success'); setTimeout(() => setMatch({ ...p, matchId: res.match_id }), 120) }
    } catch (e) {
      if (e.status === 429) setPaywall(true)
      if (e.status === 402) setToast('⭐ Суперлайки закончились')
    }
    // refresh counters occasionally
    if ((idx + 1) % 5 === 0) refreshMe?.()
    if (idx + 1 >= deck.length - 2) loadFeedAppend()
  }

  async function loadFeedAppend() {
    try {
      const cards = await api.getFeed(onlyVerified, filterTags)
      if (!cards.length) return
      setDeck((d) => {
        const have = new Set(d.map((p) => p.id))
        const fresh = cards.map((c) => apiCardToPerson(c)).filter((p) => !have.has(p.id))
        return fresh.length ? [...d, ...fresh] : d
      })
    } catch {}
  }

  async function onAction(dir) {
    if (dir === 'rewind') {
      if (!plan.rewind) { setToast('🔒 Откат доступен с Premium'); return }
      try {
        await api.rewind()
        if (idx > 0) { setIdx((i) => i - 1); setPhotoIdx(0); setSwipesLeft((s) => s + 1); haptic('light'); setToast('⏪ Свайп возвращён') }
      } catch (e) {
        if (e.status === 403) setToast('🔒 Откат доступен с Premium')
        else setToast('Нечего возвращать')
      }
      return
    }
    if (swipesLeft <= 0) { setPaywall(true); return }
    if (dir === 'super' && superLeft <= 0) { setToast('⭐ Суперлайки закончились'); return }
    haptic(dir === 'like' ? 'medium' : 'light')
    setFling({ id: person.id, dir, n: bump })
  }

  const tapPhoto = (d) => setPhotoIdx((p) => Math.max(0, Math.min((person?.photos.length || 1) - 1, p + d)))

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      <MeshBG palette={palette || THEME_MESH[theme] || VIBES.neon} />
      <div className="relative z-10 w-full h-full flex flex-col">
        <div className="safe-top screen-pad shrink-0">
          <div className="flex items-center justify-between pt-1 pb-2">
            <span className="text-[22px] font-black tracking-tight" style={{ color: accent, textShadow: !dark ? 'none' : `0 0 16px ${hexA(accent, 0.6)}` }}>CupidBot</span>
            <div className="flex items-center gap-2">
              <button onClick={openFilter} className="inline-flex items-center gap-1 rounded-full font-bold transition"
                style={{ height: 30, padding: '0 11px', fontSize: 11.5, background: filterTags.length ? hexA(accent, 0.18) : (!dark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)'),
                  color: filterTags.length ? accent : (!dark ? '#6b7280' : '#bbb'), border: `1.5px solid ${filterTags.length ? accent : (!dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)')}`, backdropFilter: 'blur(8px)' }}>
                <i className="ph-fill ph-funnel" /> {filterTags.length ? `Теги ${filterTags.length}` : 'Теги'}
              </button>
              <button onClick={() => setOnlyVerified((v) => !v)} className="inline-flex items-center gap-1 rounded-full font-bold transition"
                style={{ height: 30, padding: '0 11px', fontSize: 11.5, background: onlyVerified ? 'rgba(59,130,246,0.18)' : (!dark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)'),
                  color: onlyVerified ? '#3B82F6' : (!dark ? '#6b7280' : '#bbb'), border: `1.5px solid ${onlyVerified ? '#3B82F6' : (!dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)')}`, backdropFilter: 'blur(8px)' }}>
                <i className="ph-fill ph-seal-check" /> Verified
              </button>
            </div>
          </div>
          <div className="text-right -mt-1 mb-1"><span className="text-[12px] font-bold" style={{ color: !dark ? '#9ca3af' : 'rgba(255,255,255,0.6)' }}>{me ? `${swipesLeft} свайпов` : '…'}</span></div>
        </div>

        <div className="flex-1 min-h-0 screen-pad relative" style={{ paddingBottom: 8 }}>
          {loading ? (
            <SkeletonFeed dark={dark} />
          ) : ended ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="floaty"><ArtNoCards size={172} accent={accent} /></div>
              <h2 className="text-[24px] font-black mt-1" style={{ color: !dark ? '#0F0F13' : '#fff' }}>Пока всё пересмотрено</h2>
              <p className="mt-2 text-[15px] font-medium" style={{ color: !dark ? '#6b7280' : 'rgba(255,255,255,0.7)' }}>Новые анкеты появятся скоро. Загляни позже или расширь радиус поиска.</p>
              <div className="mt-6 w-full"><Button onClick={loadFeed} style={adult ? { background: 'linear-gradient(135deg,#FF3333,#FF00FF)' } : theme === 'oligarch' ? { background: 'linear-gradient(135deg,#FFE259,#FFA751)', color: '#0F0F13' } : {}}>Обновить ленту</Button></div>
            </div>
          ) : (
            <div className="relative w-full h-full" style={{ filter: paywall ? 'blur(8px)' : 'none', transition: 'filter .3s' }}>
              {deck[idx + 2] && <div className="absolute inset-0" style={{ transform: 'scale(0.88) translateY(24px)', opacity: 0.45 }}><div className="absolute inset-0 rounded-[2rem] overflow-hidden"><Photo data={deck[idx + 2].photos[0]} rounded="2rem" className="w-full h-full" emojiSize={120} /></div></div>}
              {deck[idx + 1] && <div className="absolute inset-0" style={{ transform: 'scale(0.94) translateY(12px)', opacity: 0.85 }}><ProfileCard person={deck[idx + 1]} theme={theme} photoIdx={0} /></div>}
              {person && <SwipeCard key={person.id + '-' + bump} person={person} theme={theme} onDecide={decide} photoIdx={photoIdx} onTapPhoto={tapPhoto} fling={fling} onOpenProfile={onOpenProfile} />}
            </div>
          )}
        </div>

        {!ended && !loading && (
          <div className="shrink-0 screen-pad" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)', paddingTop: 4 }}>
            <ActionBar theme={theme} plan={plan} superLeft={superLeft} canRewind={plan.rewind} onAction={onAction} />
          </div>
        )}
      </div>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)}>
        <div className="text-center mb-2">
          <h2 className="text-[20px] font-black text-[#0F0F13]">Фильтр по интересам</h2>
          <p className="text-[13px] text-[#6b7280] mt-0.5">Показывать только тех, у кого есть выбранные теги</p>
        </div>
        <div className="overflow-y-auto noscroll" style={{ maxHeight: '46vh' }}>
          {Object.entries(allTags.filter((t) => !t.is_18_only || adult).reduce((acc, t) => {
            const c = t.category || 'Другое'; (acc[c] = acc[c] || []).push(t); return acc
          }, {})).map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5 px-1">{cat}</div>
              <div className="flex flex-wrap gap-2">
                {list.map((t) => (
                  <Pill key={t.id} interest={{ id: t.id, label: t.name, color: t.color_hex || '#FF00FF', emoji: t.emoji }}
                    selected={tempFilter.includes(t.id)} onClick={() => toggleTemp(t.id)} small />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="ghost" className="flex-1" onClick={() => { setTempFilter([]); setFilterTags([]); setFilterOpen(false) }}>Сбросить</Button>
          <Button className="flex-1" onClick={() => { setFilterTags(tempFilter); setFilterOpen(false) }}>Применить</Button>
        </div>
      </Sheet>

      <Paywall open={paywall} onClose={() => setPaywall(false)} onUpgrade={(p) => { setPaywall(false); onUpgrade(p) }} />
      {match && <MatchModal person={match} theme={theme} me={me} onWrite={() => { onMatch(match.matchId); setMatch(null) }} onContinue={() => setMatch(null)} />}
      <TabBar active={active} onTab={onTab} accent={accent} dark={dark} dots={dots} />
    </div>
  )
}
