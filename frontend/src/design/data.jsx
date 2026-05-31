/* Data helpers: interests catalog, gradient placeholders, plans, API→card mapping */

// Static fallback catalog (matches backend seed tags by name). Used for emoji/color when rendering.
export const INTERESTS = [
  { id: 'sport', label: 'Спорт', emoji: '🏋️', color: '#EF4444' },
  { id: 'music', label: 'Музыка', emoji: '🎵', color: '#8B5CF6' },
  { id: 'travel', label: 'Путешествия', emoji: '✈️', color: '#3B82F6' },
  { id: 'cinema', label: 'Кино', emoji: '🎬', color: '#F59E0B' },
  { id: 'informal', label: 'Неформалка', emoji: '💀', color: '#0F0F13' },
  { id: 'cats', label: 'Кошки', emoji: '🐱', color: '#FF66CC' },
  { id: 'dogs', label: 'Собаки', emoji: '🐶', color: '#F97316' },
  { id: 'skate', label: 'Скейт', emoji: '🛹', color: '#10B981' },
  { id: 'code', label: 'Программирование', emoji: '💻', color: '#06B6D4' },
  { id: 'cooking', label: 'Готовка', emoji: '🍳', color: '#EAB308' },
]

// Dynamic catalog filled from API tags (keyed by numeric id). interest objects = {id,label,color,emoji}
const _byId = new Map()
export function registerTags(apiTags) {
  for (const t of apiTags || []) {
    _byId.set(t.id, { id: t.id, label: t.name, color: t.color_hex || '#FF00FF', emoji: t.emoji || '🏷️' })
  }
}
export function interestById(id) {
  if (_byId.has(id)) return _byId.get(id)
  return INTERESTS.find((i) => i.id === id) || null
}

export const GRADS = [
  ['#FF9A9E', '#FAD0C4'], ['#A18CD1', '#FBC2EB'], ['#FFA751', '#FFE259'],
  ['#84FAB0', '#8FD3F4'], ['#FF6CAB', '#7366FF'], ['#F093FB', '#F5576C'],
  ['#4FACFE', '#00F2FE'], ['#FA709A', '#FEE140'], ['#30CFD0', '#330867'],
  ['#FF867A', '#FF8C7F'], ['#5EE7DF', '#B490CA'], ['#D9AFD9', '#97D9E1'],
  ['#FBAB7E', '#F7CE68'], ['#FF5ACD', '#FBDA61'], ['#6A11CB', '#2575FC'],
  ['#F857A6', '#FF5858'],
]
export function gradPhoto(seed, emoji = '✨') {
  const g = GRADS[Math.abs(seed) % GRADS.length]
  return { from: g[0], to: g[1], emoji }
}

// Plan config drives UI gating
export const PLANS = {
  free:    { id: 'free',    label: 'Free',       badge: 'Free',       swipes: 50,  superlikes: 0, barge: 0,  tgMsgs: 15, rewind: false, viewers: false, oligarch: false },
  premium: { id: 'premium', label: 'Premium 💎', badge: 'Premium 💎', swipes: 200, superlikes: 5, barge: 3,  tgMsgs: 5,  rewind: true,  viewers: true,  oligarch: false },
  kupidon: { id: 'kupidon', label: 'Kupidon 👑', badge: 'Kupidon 👑', swipes: 500, superlikes: 5, barge: 15, tgMsgs: 0,  rewind: true,  viewers: true,  oligarch: true  },
}

// Age from ISO birth_date
export function ageFromBirth(birth) {
  if (!birth) return 0
  const d = new Date(birth), now = new Date()
  return now.getFullYear() - d.getFullYear() - ((now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) ? 1 : 0)
}

// birth_date (ISO) from an age number — used in onboarding (backend stores DATE)
export function birthFromAge(age) {
  const now = new Date()
  const y = now.getFullYear() - age
  return `${y}-01-01`
}

const VIBE_EMOJI = ['😎', '🌸', '🎧', '🏔️', '🎸', '🌊', '☕', '🌟', '🎬', '🍷']

// Convert an API feed card to the design's `person` shape.
export function apiCardToPerson(c, hasFullMedia = true) {
  const photos = (c.media && c.media.length)
    ? c.media.map((url) => ({ url }))
    : [gradPhoto((c.name || '?').charCodeAt(0), VIBE_EMOJI[(c.name || '?').charCodeAt(0) % VIBE_EMOJI.length])]
  return {
    id: c.id,
    name: c.name,
    age: ageFromBirth(c.birth_date),
    city: c.city_name || 'Рядом',
    dist: c.dist || '',
    verified: !!c.is_verified,
    gender: c.gender,
    tags: (c.tags || []).map((t) => { registerTags([t]); return t.id }),
    bio: c.bio || '',
    photos,
    common: c.common_tags_count || 0,
  }
}

// Convert API "me" profile to design user shape (photos array of {url})
export function apiMeToUser(me, mediaUrls) {
  const photos = (mediaUrls && mediaUrls.length)
    ? mediaUrls.map((url) => ({ url }))
    : [gradPhoto((me.name || '?').charCodeAt(0), '😎')]
  while (photos.length < 5) photos.push(null)
  return {
    name: me.name, age: ageFromBirth(me.birth_date), gender: me.gender, looking: me.search_gender,
    city: { name: me.city_name || 'Москва' }, photos, tags: (me.tag_ids || []), bio: me.bio || '',
  }
}
