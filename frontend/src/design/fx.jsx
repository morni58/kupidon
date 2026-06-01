/* FX layer: animated mesh, grain, auras, score ring, equalizer */
import { useState, useEffect, useRef } from 'react'

const GRAIN_URI = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function Grain({ opacity = 0.07, blend = 'overlay', animate = true, className = '' }) {
  return (
    <div className={'absolute inset-0 pointer-events-none ' + (animate ? 'grain ' : '') + className}
      style={{ backgroundImage: GRAIN_URI, backgroundSize: '160px 160px', opacity, mixBlendMode: blend, inset: '-20%' }} />
  )
}

export const VIBES = {
  neon:   { id: 'neon', name: 'Неон', accent: '#FF00FF', base: '#FAFAFC', dark: false,
    blobs: [['#FF00FF', 18, 12, 70, 0.30, 'mesh-a'], ['#FF66CC', 82, 28, 64, 0.32, 'mesh-b'], ['#A855F7', 48, 90, 76, 0.26, 'mesh-c'], ['#22D3EE', 92, 80, 50, 0.18, 'mesh-a']] },
  sunset: { id: 'sunset', name: 'Закат', accent: '#FF7849', base: '#FFF7F2', dark: false,
    blobs: [['#FF7849', 16, 14, 72, 0.34, 'mesh-a'], ['#FF4D8D', 84, 22, 60, 0.30, 'mesh-b'], ['#FFB547', 40, 92, 78, 0.30, 'mesh-c'], ['#FF2D55', 88, 86, 48, 0.20, 'mesh-a']] },
  ocean:  { id: 'ocean', name: 'Океан', accent: '#0EA5E9', base: '#F2FBFF', dark: false,
    blobs: [['#22D3EE', 18, 14, 70, 0.30, 'mesh-a'], ['#0EA5E9', 84, 26, 64, 0.30, 'mesh-b'], ['#2DD4BF', 44, 92, 76, 0.28, 'mesh-c'], ['#6366F1', 90, 82, 50, 0.18, 'mesh-a']] },
  forest: { id: 'forest', name: 'Лес', accent: '#10B981', base: '#F3FBF6', dark: false,
    blobs: [['#10B981', 16, 14, 72, 0.30, 'mesh-a'], ['#34D399', 84, 24, 60, 0.30, 'mesh-b'], ['#A3E635', 42, 92, 78, 0.26, 'mesh-c'], ['#14B8A6', 90, 84, 50, 0.18, 'mesh-a']] },
  berry:  { id: 'berry', name: 'Ягода', accent: '#A855F7', base: '#FAF5FF', dark: false,
    blobs: [['#A855F7', 18, 12, 70, 0.32, 'mesh-a'], ['#EC4899', 84, 26, 62, 0.30, 'mesh-b'], ['#7C3AED', 46, 92, 76, 0.26, 'mesh-c'], ['#F472B6', 90, 82, 48, 0.20, 'mesh-a']] },
  gold:   { id: 'gold', name: 'Золото', accent: '#E0A82E', base: '#FFFBF0', dark: false,
    blobs: [['#FFD700', 16, 14, 72, 0.34, 'mesh-a'], ['#F59E0B', 84, 24, 60, 0.32, 'mesh-b'], ['#FCD34D', 42, 92, 78, 0.30, 'mesh-c'], ['#B45309', 90, 84, 48, 0.18, 'mesh-a']] },
}
export const VIBE_LIST = Object.values(VIBES)

export const THEME_MESH = {
  light: VIBES.neon,
  adult: { base: '#0A0000', dark: true, accent: '#FF3333',
    blobs: [['#FF2D2D', 22, 18, 70, 0.40, 'mesh-a'], ['#7A0010', 82, 30, 76, 0.55, 'mesh-b'], ['#FF5A3C', 50, 96, 70, 0.30, 'mesh-c'], ['#3A0008', 88, 84, 60, 0.6, 'mesh-a']] },
  oligarch: { base: '#141416', dark: true, accent: '#FFD700',
    blobs: [['#FFD700', 20, 16, 60, 0.22, 'mesh-a'], ['#7A5C12', 84, 30, 72, 0.40, 'mesh-b'], ['#B8860B', 46, 96, 66, 0.26, 'mesh-c'], ['#2A210A', 88, 86, 64, 0.6, 'mesh-a']] },
}

// Build a dark-themed palette from any vibe: same accent colours, dark base.
// This is the plain "dark mode" (not the 18+/oligarch themes).
export function darkVibe(vibe) {
  const v = vibe || VIBES.neon
  return {
    id: v.id + '-dark', name: v.name, accent: v.accent, base: '#0C0C10', dark: true,
    blobs: v.blobs.map((b) => [b[0], b[1], b[2], b[3], Math.min(0.5, b[4] + 0.06), b[5]]),
  }
}

export function MeshBG({ palette, className = '', style = {}, grain = true, grainOpacity, drift = true }) {
  const p = palette || VIBES.neon
  return (
    <div className={'absolute inset-0 overflow-hidden ' + className} style={{ background: p.base, ...style }}>
      {p.blobs.map((b, i) => {
        const [c, x, y, s, op, anim] = b
        return (
          <div key={i} className={drift ? anim : ''} style={{
            position: 'absolute', left: x + '%', top: y + '%', width: s + 'vw', height: s + 'vw',
            maxWidth: 520, maxHeight: 520, transform: 'translate(-50%,-50%)',
            background: `radial-gradient(circle at center, ${c}, transparent 68%)`,
            opacity: op, filter: 'blur(8px)', borderRadius: '50%', willChange: 'transform',
          }} />
        )
      })}
      {grain && <Grain opacity={grainOpacity != null ? grainOpacity : (p.dark ? 0.10 : 0.06)} blend={p.dark ? 'soft-light' : 'overlay'} />}
    </div>
  )
}

export function ScoreRing({ value, size = 96, stroke = 9, color = '#FF00FF', track = 'rgba(0,0,0,0.08)', label }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf, start
    const dur = 900
    const step = (t) => { if (!start) start = t; const k = Math.min(1, (t - start) / dur); setN(Math.round(value * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - n / 100)
  const gid = 'rg' + Math.round(value) + size
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#FF66CC" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .1s linear', filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black leading-none" style={{ fontSize: size * 0.28, color }}>{n}<span style={{ fontSize: size * 0.16 }}>%</span></span>
        {label && <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color }}>{label}</span>}
      </div>
    </div>
  )
}

export function Equalizer({ color = '#FF00FF', bars = 5, height = 18 }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{ width: 3, background: color, borderRadius: 3, height: '40%',
          animation: `eq ${0.6 + (i % 3) * 0.25}s ease-in-out ${i * 0.12}s infinite`, transformOrigin: 'bottom' }} />
      ))}
    </div>
  )
}

export function hexA(hex, a) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
