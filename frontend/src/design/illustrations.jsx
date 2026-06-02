/* CupidBot — unique branded SVG illustrations (replace flat emojis) */

const G = (id, from, to) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} />
  </linearGradient>
)

// Empty feed — a radar/globe scanning for hearts, with floating cards
export function ArtNoCards({ size = 168, accent = '#FF00FF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <defs>
        {G('nc1', '#FF00FF', '#FF66CC')}
        {G('nc2', '#A855F7', '#22D3EE')}
        <radialGradient id="ncglow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" /><stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="95" r="90" fill="url(#ncglow)" />
      {/* radar rings */}
      <circle cx="100" cy="95" r="64" stroke="url(#nc1)" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="100" cy="95" r="44" stroke="url(#nc1)" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="100" cy="95" r="24" stroke="url(#nc1)" strokeOpacity="0.7" strokeWidth="2" />
      {/* sweep */}
      <path d="M100 95 L100 31 A64 64 0 0 1 156 70 Z" fill="url(#nc1)" opacity="0.12" />
      {/* floating mini cards */}
      <g transform="rotate(-12 56 60)"><rect x="40" y="44" width="32" height="42" rx="8" fill="#fff" stroke="url(#nc2)" strokeWidth="2.5" /><circle cx="56" cy="60" r="7" fill="url(#nc2)" /></g>
      <g transform="rotate(10 150 64)"><rect x="134" y="48" width="32" height="42" rx="8" fill="#fff" stroke="url(#nc1)" strokeWidth="2.5" /><circle cx="150" cy="64" r="7" fill="url(#nc1)" /></g>
      {/* center heart */}
      <path d="M100 118c-22-14-34-26-34-42 0-11 8-19 18-19 7 0 13 4 16 10 3-6 9-10 16-10 10 0 18 8 18 19 0 16-12 28-34 42z" fill="url(#nc1)" />
      <circle cx="100" cy="95" r="3" fill="#fff" />
    </svg>
  )
}

// Empty likes — two hearts orbiting, waiting for a spark
export function ArtNoLikes({ size = 150 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <defs>{G('nl1', '#FF00FF', '#FF66CC')}{G('nl2', '#FFD700', '#FFA751')}
        <radialGradient id="nlglow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#FF00FF" stopOpacity="0.25" /><stop offset="100%" stopColor="#FF00FF" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="url(#nlglow)" />
      <ellipse cx="100" cy="100" rx="70" ry="40" stroke="url(#nl1)" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 7" />
      <path d="M74 112c-16-10-25-19-25-31 0-8 6-14 13-14 5 0 10 3 12 7 2-4 7-7 12-7 7 0 13 6 13 14 0 12-9 21-25 31z" fill="url(#nl1)" opacity="0.95" />
      <path d="M132 92c-12-8-19-14-19-23 0-6 5-11 10-11 4 0 7 2 9 5 2-3 5-5 9-5 5 0 10 5 10 11 0 9-7 15-19 23z" fill="url(#nl2)" />
      <circle cx="158" cy="64" r="4" fill="#FF66CC" /><circle cx="44" cy="140" r="3" fill="#A855F7" />
    </svg>
  )
}

// Empty chats — speech bubbles with a heart spark
export function ArtNoChats({ size = 150 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <defs>{G('nch1', '#FF00FF', '#FF66CC')}{G('nch2', '#22D3EE', '#6366F1')}
        <radialGradient id="nchglow" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#FF66CC" stopOpacity="0.25" /><stop offset="100%" stopColor="#FF66CC" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="url(#nchglow)" />
      <path d="M44 58h78a16 16 0 0 1 16 16v34a16 16 0 0 1-16 16H74l-22 18v-18h-8a16 16 0 0 1-16-16V74a16 16 0 0 1 16-16z" fill="#fff" stroke="url(#nch1)" strokeWidth="3" />
      <path d="M150 96h12a14 14 0 0 1 14 14v22a14 14 0 0 1-14 14h4v14l-18-14h-22a14 14 0 0 1-14-14" fill="#fff" stroke="url(#nch2)" strokeWidth="3" opacity="0.9" />
      <path d="M82 96c-9-6-14-11-14-18 0-5 4-9 9-9 3 0 6 2 7 4 1-2 4-4 7-4 5 0 9 4 9 9 0 7-5 12-18 18z" fill="url(#nch1)" />
      <circle cx="116" cy="86" r="3.5" fill="#FF66CC" />
    </svg>
  )
}

// Generic decorative heart-burst used as section flourish
export function ArtHeartBurst({ size = 64, accent = '#FF00FF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>{G('hb', accent, '#FF66CC')}</defs>
      <path d="M32 50c-14-9-22-17-22-27 0-7 5-12 11-12 5 0 9 3 11 7 2-4 6-7 11-7 6 0 11 5 11 12 0 10-8 18-22 27z" fill="url(#hb)" />
      <circle cx="12" cy="16" r="2.5" fill={accent} opacity="0.6" /><circle cx="54" cy="20" r="2" fill="#FF66CC" opacity="0.7" /><circle cx="50" cy="48" r="2" fill={accent} opacity="0.5" />
    </svg>
  )
}

// Verified shield illustration (profile CTA)
export function ArtVerify({ size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <defs>{G('vf', '#3B82F6', '#6366F1')}
        <radialGradient id="vfg" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" /><stop offset="100%" stopColor="#3B82F6" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="48" cy="44" r="44" fill="url(#vfg)" />
      <path d="M48 14l26 10v20c0 18-12 30-26 36-14-6-26-18-26-36V24z" fill="url(#vf)" />
      <path d="M37 46l8 8 16-17" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
