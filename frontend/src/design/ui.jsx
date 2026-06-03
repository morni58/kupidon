/* Shared UI primitives — Photo supports real image URLs + gradient fallback */
import { useRef } from 'react'
import { interestById } from './data'

const isVideo = (url) => typeof url === 'string' && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)

// Photo: real <img>/<video> if data.url present, else gradient + big emoji
export function Photo({ data, rounded = '2rem', className = '', emojiSize = 96, children, dim = false }) {
  if (!data) return null
  const hasUrl = !!data.url
  const video = hasUrl && (data.video || isVideo(data.url))
  return (
    <div className={'relative overflow-hidden ' + className}
      style={{ borderRadius: rounded, background: hasUrl ? '#111' : `linear-gradient(150deg, ${data.from}, ${data.to})` }}>
      {video ? (
        <video src={data.url} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }}
          autoPlay muted loop playsInline preload="metadata" />
      ) : hasUrl ? (
        <img src={data.url} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} draggable={false} loading="lazy" />
      ) : (
        <>
          <div className="absolute -top-10 -left-8 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.35)', filter: 'blur(28px)' }} />
          <div className="absolute bottom-0 right-0 w-44 h-44 rounded-full" style={{ background: 'rgba(0,0,0,0.18)', filter: 'blur(34px)' }} />
          <div className="absolute inset-0 flex items-center justify-center select-none" style={{ fontSize: emojiSize, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.18))' }}>
            <span style={{ transform: 'translateZ(0)' }}>{data.emoji}</span>
          </div>
        </>
      )}
      {dim && <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />}
      {children}
    </div>
  )
}

export function Avatar({ data, size = 48, ring = false }) {
  return (
    <div className="shrink-0 relative" style={{ width: size, height: size }}>
      <Photo data={data} rounded="9999px" className="w-full h-full" emojiSize={size * 0.55} />
      {ring && <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 2px #fff, 0 0 0 4px #FF00FF' }} />}
    </div>
  )
}

export function Button({ variant = 'primary', children, onClick, disabled, className = '', style = {}, size = 'md' }) {
  const base = 'relative inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition-all active:scale-[0.97] select-none'
  const sizes = { md: 'h-14 px-6 text-[16px]', sm: 'h-10 px-4 text-[14px]', lg: 'h-15 px-7 text-[17px]' }
  const variants = {
    primary: 'text-white', secondary: 'bg-white text-[#0F0F13] border-2 border-[#e5e7eb]',
    ghost: 'text-[#6b7280] bg-transparent', gold: 'text-[#0F0F13]', blue: 'text-white',
  }
  const vstyle = {
    primary: { background: 'var(--cupid-grad)', boxShadow: disabled ? 'none' : '0 12px 30px -8px var(--cupid-accent)' },
    gold: { background: 'linear-gradient(135deg,#FFE259,#FFA751)', boxShadow: disabled ? 'none' : '0 10px 28px -8px rgba(255,168,81,0.55)' },
    blue: { background: 'linear-gradient(135deg,#3B82F6,#6366F1)', boxShadow: disabled ? 'none' : '0 10px 28px -8px rgba(59,130,246,0.5)' },
    secondary: {}, ghost: {},
  }[variant]
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={{ opacity: disabled ? 0.4 : 1, ...vstyle, ...style }}>
      {children}
    </button>
  )
}

export function Toggle({ on, onChange, color = 'var(--cupid-accent)' }) {
  return (
    <button onClick={() => onChange(!on)} className="relative shrink-0 rounded-full transition-colors duration-200"
      style={{ width: 48, height: 26, background: on ? color : 'rgba(130,130,145,0.4)' }}>
      <span className="absolute top-[3px] rounded-full bg-white transition-all duration-200"
        style={{ width: 20, height: 20, left: on ? 25 : 3, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

export function Pill({ interest, selected, onClick, dim, glass, small }) {
  const i = typeof interest === 'string' ? interestById(interest) : interest
  if (!i) return null
  const h = small ? 28 : 32
  if (glass) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full font-semibold text-white"
        style={{ height: h, padding: '0 12px', fontSize: small ? 11 : 12.5, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', backdropFilter: 'blur(6px)' }}>
        <span>{i.emoji}</span>{i.label}
      </span>
    )
  }
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full font-semibold transition-all active:scale-95"
      style={{ height: h, padding: '0 14px', fontSize: 13, border: `2px solid ${i.color}`,
        background: selected ? i.color : 'transparent',
        color: selected ? '#fff' : i.color === '#0F0F13' ? '#0F0F13' : i.color,
        opacity: dim ? 0.35 : 1, boxShadow: selected ? `0 6px 18px -6px ${i.color}` : 'none', cursor: onClick ? 'pointer' : 'default' }}>
      <span>{i.emoji}</span>{i.label}
    </button>
  )
}

export function Badge({ kind = 'verified', children, className = '' }) {
  const map = {
    verified: { bg: 'rgba(59,130,246,0.14)', fg: '#3B82F6', txt: <><i className="ph-fill ph-seal-check" /> Verified</> },
    common: { bg: 'rgba(16,185,129,0.14)', fg: '#10B981', txt: children || '3 общих тега' },
    vip: { bg: 'rgba(255,215,0,0.18)', fg: '#B8860B', txt: <>👑 VIP</> },
    glass: { bg: 'rgba(255,255,255,0.2)', fg: '#fff', txt: children },
  }
  const m = map[kind] || map.verified
  return (
    <span className={'inline-flex items-center gap-1 rounded-full font-bold ' + className}
      style={{ background: m.bg, color: m.fg, fontSize: 11.5, padding: '4px 9px',
        border: kind === 'glass' ? '1px solid rgba(255,255,255,0.4)' : 'none', backdropFilter: kind === 'glass' ? 'blur(6px)' : 'none' }}>
      {children && kind !== 'common' ? children : m.txt}
    </span>
  )
}

export function VerifiedTick({ size = 18 }) {
  return <i className="ph-fill ph-seal-check" style={{ color: '#3B82F6', fontSize: size }} />
}

export function Skeleton({ className = '', style = {} }) {
  return <div className={'bg-[#e5e7eb] rounded-xl animate-pulse ' + className} style={style} />
}

export function Sheet({ open, onClose, children, dark = false }) {
  return (
    <div className={'absolute inset-0 z-40 transition-all duration-300 ' + (open ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div className="absolute inset-0 transition-opacity duration-300" style={{ background: 'rgba(0,0,0,0.6)', opacity: open ? 1 : 0 }} onClick={onClose} />
      <div className="absolute left-0 right-0 bottom-0 transition-transform duration-300"
        style={{ transform: open ? 'translateY(0)' : 'translateY(110%)', background: dark ? '#141416' : '#fff',
          borderTopLeftRadius: '2rem', borderTopRightRadius: '2rem', padding: '12px 20px 28px', boxShadow: '0 -20px 50px rgba(0,0,0,0.25)' }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: '#d1d5db' }} />
        {children}
      </div>
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="absolute left-0 right-0 z-50 flex justify-center pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top) + 54px)' }}>
      <div className="rounded-full font-semibold text-[13px] text-white shadow-lg" style={{ padding: '9px 16px', background: 'rgba(15,15,19,0.92)', backdropFilter: 'blur(8px)', animation: 'toastIn .3s ease' }}>
        {toast}
      </div>
    </div>
  )
}

const TABS = [
  { id: 'feed', icon: 'ph-cards', label: 'Лента' },
  { id: 'likes', icon: 'ph-heart', label: 'Симпатии' },
  { id: 'chats', icon: 'ph-chat-circle', label: 'Чаты' },
  { id: 'profile', icon: 'ph-user', label: 'Профиль' },
]
export function TabBar({ active, onTab, accent = '#FF00FF', dark = false, dots = {} }) {
  return (
    <div className="absolute left-0 right-0 bottom-0 z-30"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)',
        background: dark ? 'rgba(20,20,22,0.8)' : 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)',
        borderTop: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-16 flex items-stretch">
        {TABS.map((t) => {
          const on = active === t.id
          return (
            <button key={t.id} onClick={() => onTab(t.id)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-transform"
              style={{ transform: on ? 'scale(1.08)' : 'scale(1)' }}>
              <span className="relative">
                <i className={`ph-fill ${t.icon}`} style={{ fontSize: 24, color: on ? accent : (dark ? '#888' : '#9ca3af'), opacity: on ? 1 : 0.6 }} />
                {dots[t.id] && <span className="absolute -top-0.5 -right-1 rounded-full" style={{ width: 8, height: 8, background: '#EF4444', boxShadow: '0 0 0 2px ' + (dark ? '#141416' : '#fff') }} />}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: on ? accent : (dark ? '#888' : '#9ca3af'), opacity: on ? 1 : 0.6 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Progress({ value, track = '#e5e7eb', height = 8, gradient = 'linear-gradient(135deg,#FF00FF,#FF66CC)' }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: gradient }} />
    </div>
  )
}

export function Confetti({ run = true, count = 80 }) {
  const colors = ['#FF00FF', '#FF66CC', '#FFD700', '#10B981', '#3B82F6']
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.8 + Math.random() * 1.6,
      color: colors[i % colors.length], size: 6 + Math.random() * 8, rot: Math.random() * 360, round: Math.random() > 0.5,
    }))
  ).current
  if (!run) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {pieces.map((p, i) => (
        <span key={i} className="absolute" style={{ left: p.left + '%', top: '-20px', width: p.size, height: p.size,
          background: p.color, borderRadius: p.round ? '50%' : '2px', transform: `rotate(${p.rot}deg)`, animation: `confettiFall ${p.dur}s ${p.delay}s ease-in forwards` }} />
      ))}
    </div>
  )
}
