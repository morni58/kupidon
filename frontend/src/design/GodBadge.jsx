/**
 * GodBadge — exclusive "Бог" role badge with SVG crown + shimmer glow.
 * Used in: profile cover, feed card, chat header, UserProfile.
 */

// Intricate SVG crown — no emoji, fully vector
export function CrownSvg({ size = 20, glow = false }) {
  const id = 'gcg-' + size
  return (
    <svg width={size} height={size * 0.74} viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.4}px #FFD700) drop-shadow(0 0 ${size * 0.7}px rgba(255,180,0,0.6))` } : {}}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF176" />
          <stop offset="35%" stopColor="#FFD700" />
          <stop offset="70%" stopColor="#FFA000" />
          <stop offset="100%" stopColor="#FF8C00" />
        </linearGradient>
      </defs>
      {/* crown body */}
      <path d="M2 26 L5 10 L13 18 L20 2 L27 18 L35 10 L38 26 Z"
        fill={`url(#${id})`} stroke="#B8860B" strokeWidth="1.2" strokeLinejoin="round" />
      {/* base bar */}
      <rect x="2" y="24" width="36" height="4" rx="2" fill={`url(#${id})`} stroke="#B8860B" strokeWidth="0.8" />
      {/* gems */}
      <circle cx="20" cy="4" r="2.2" fill="#fff" opacity="0.9" />
      <circle cx="13" cy="17" r="1.8" fill="#fff" opacity="0.75" />
      <circle cx="27" cy="17" r="1.8" fill="#fff" opacity="0.75" />
      {/* shine */}
      <path d="M7 22 Q10 15 14 18" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// Inline "Бог" badge — used in nameplates, chat headers, likes
export function GodBadge({ size = 'md' }) {
  const cfg = {
    sm:  { fs: 10,   h: 20,  px: 7,  crown: 13, gap: 3 },
    md:  { fs: 12,   h: 26,  px: 10, crown: 16, gap: 4 },
    lg:  { fs: 14.5, h: 32,  px: 13, crown: 20, gap: 5 },
    xl:  { fs: 17,   h: 38,  px: 16, crown: 24, gap: 6 },
  }[size] || {}
  return (
    <span className="god-badge inline-flex items-center shrink-0"
      style={{
        height: cfg.h, padding: `0 ${cfg.px}px`, gap: cfg.gap, borderRadius: cfg.h / 2,
        background: 'linear-gradient(135deg,#2a1a00 0%,#5c3400 40%,#2a1a00 100%)',
        border: '1.5px solid rgba(255,215,0,0.7)',
        boxShadow: '0 0 14px rgba(255,180,0,0.55), 0 0 4px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,200,0.3)',
        fontWeight: 900, fontSize: cfg.fs, letterSpacing: '0.04em', whiteSpace: 'nowrap',
        color: '#FFD700', textShadow: '0 0 8px rgba(255,200,0,0.9)',
      }}>
      <CrownSvg size={cfg.crown} glow={false} />
      <span>Бог</span>
    </span>
  )
}

// Full immersive header nameplate for profile cover
export function GodNameplate({ name, age, city, verified }) {
  return (
    <div className="god-nameplate relative overflow-hidden rounded-[1.4rem] px-4 pt-3 pb-3.5"
      style={{
        background: 'linear-gradient(160deg, rgba(18,9,0,0.55) 0%, rgba(40,20,0,0.48) 100%)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        border: '1px solid rgba(255,180,0,0.38)',
        boxShadow: '0 0 32px rgba(255,160,0,0.22), inset 0 1px 0 rgba(255,220,100,0.28)',
      }}>
      {/* animated shimmer bar at top */}
      <div className="god-shimmer" />
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="text-[26px] font-black leading-none tracking-tight"
          style={{ color: '#FFE680', textShadow: '0 0 20px rgba(255,200,0,0.7)' }}>
          {name}{age ? `, ${age}` : ''}
        </h1>
        {verified && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" fill="#3B82F6" />
            <path d="M6 10l2.5 2.5L14 7.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="ml-auto"><GodBadge size="md" /></span>
      </div>
      {city && (
        <p className="mt-1 text-[12px] font-semibold flex items-center gap-1" style={{ color: 'rgba(255,215,0,0.75)' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="4.5" r="2.5" stroke="#FFD700" strokeWidth="1.2" /><path d="M5.5 10C5.5 10 1.5 7 1.5 4.5a4 4 0 018 0C9.5 7 5.5 10 5.5 10z" stroke="#FFD700" strokeWidth="1.2" /></svg>
          {city}
        </p>
      )}
    </div>
  )
}
