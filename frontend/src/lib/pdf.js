/* Beautiful, branded "profile card" PDF export.
 * Curated data only — no internal/hidden parameters. */
import { jsPDF } from 'jspdf'
import { mediaUrl } from './api'

const MAGENTA = [255, 0, 255]
const PINK = [255, 102, 204]
const INK = [15, 15, 19]
const GRAY = [107, 114, 128]
const LIGHT = [243, 244, 246]

const PROMPTS = [
  ['green_flags', 'Грин-флаги', [16, 185, 129]],
  ['red_flags', 'Ред-флаги', [239, 68, 68]],
  ['ideal_date', 'Идеальное свидание', [255, 0, 255]],
  ['looking_for', 'Что ищу', [59, 130, 246]],
  ['weakness', 'Слабость', [245, 158, 11]],
]

const PLAN = { free: 'Free', premium: 'Premium', kupidon: 'Kupidon VIP' }

// Fetch an image URL and return a JPEG/PNG dataURL (or null on failure).
async function imageToDataUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!/^image\//.test(blob.type)) return null
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

function ageFrom(birth) {
  if (!birth) return null
  const b = new Date(birth), t = new Date()
  let a = t.getFullYear() - b.getFullYear()
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--
  return a
}

export async function buildProfilePdf({ full, stats, tagNames = [] }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  let y = 0

  // ---- Header band with gradient (simulated via vertical strips) ----
  const headH = 210
  const steps = 60
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const r = Math.round(MAGENTA[0] + (PINK[0] - MAGENTA[0]) * t)
    const g = Math.round(MAGENTA[1] + (PINK[1] - MAGENTA[1]) * t)
    const b = Math.round(MAGENTA[2] + (PINK[2] - MAGENTA[2]) * t)
    doc.setFillColor(r, g, b)
    doc.rect((W / steps) * i, 0, W / steps + 1, headH, 'F')
  }
  // soft decorative circles
  doc.setFillColor(255, 255, 255)
  doc.setGState(new doc.GState({ opacity: 0.12 }))
  doc.circle(W - 50, 40, 80, 'F')
  doc.circle(60, headH - 20, 55, 'F')
  doc.setGState(new doc.GState({ opacity: 1 }))

  // brand
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text('CupidBot', M, 40)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Карточка профиля', M, 56)

  // avatar (rounded square in a white frame — robust, no clipping)
  const avSize = 96, avX = M, avY = 78, rad = 20
  let avatar = null
  const firstImg = (full.media || []).map(mediaUrl).find((u) => u && !/\.(mp4|webm|mov)$/i.test(u))
  if (firstImg) avatar = await imageToDataUrl(firstImg)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(avX - 4, avY - 4, avSize + 8, avSize + 8, rad + 3, rad + 3, 'F')
  if (avatar) {
    try { doc.addImage(avatar, 'JPEG', avX, avY, avSize, avSize, undefined, 'FAST') } catch {}
  } else {
    doc.setFillColor(MAGENTA[0], MAGENTA[1], MAGENTA[2])
    doc.roundedRect(avX, avY, avSize, avSize, rad, rad, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(40)
    doc.text((full.name || '?')[0].toUpperCase(), avX + avSize / 2, avY + avSize / 2 + 14, { align: 'center' })
  }

  // name block (right of avatar)
  const age = ageFrom(full.birth_date)
  const nx = avX + avSize + 22
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24)
  doc.text(`${full.name || '—'}${age ? `, ${age}` : ''}`, nx, avY + 30)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  let meta = full.city_name || 'Рядом'
  doc.text(meta, nx, avY + 50)
  // badges
  let bx = nx
  const badge = (label, fill, fg = [255, 255, 255]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
    const w = doc.getTextWidth(label) + 16
    doc.setFillColor(fill[0], fill[1], fill[2])
    doc.roundedRect(bx, avY + 62, w, 18, 9, 9, 'F')
    doc.setTextColor(fg[0], fg[1], fg[2])
    doc.text(label, bx + 8, avY + 74)
    bx += w + 8
  }
  badge(PLAN[full.tier] || 'Free', full.tier === 'kupidon' ? [255, 200, 60] : [255, 255, 255], full.tier === 'kupidon' ? INK : MAGENTA)
  if (full.is_verified) badge('✓ Verified', [59, 130, 246])

  y = headH + 30

  // ---- helper: section title ----
  const section = (title) => {
    doc.setTextColor(INK[0], INK[1], INK[2])
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text(title, M, y)
    doc.setDrawColor(MAGENTA[0], MAGENTA[1], MAGENTA[2]); doc.setLineWidth(2)
    doc.line(M, y + 6, M + 26, y + 6)
    y += 22
  }
  const ensure = (need) => { if (y + need > H - 60) { doc.addPage(); y = 50 } }

  // ---- Stats cards ----
  if (stats) {
    section('Моя статистика')
    const cards = [
      ['Мэтчей', String(stats.matches ?? 0)],
      ['Лайков получено', String(stats.likes_received ?? 0)],
      ['Лайков отправлено', String(stats.likes_given ?? 0)],
      ['Мэтч-рейт', `${stats.match_rate ?? 0}%`],
      ['Дней с нами', String(stats.days_with_us ?? 0)],
      ['Рейтинг анкеты', `${stats.profile_score ?? 0}/100`],
    ]
    const cols = 3, gap = 12
    const cw = (W - M * 2 - gap * (cols - 1)) / cols
    const ch = 56
    cards.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const cx = M + col * (cw + gap), cy = y + row * (ch + gap)
      doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
      doc.roundedRect(cx, cy, cw, ch, 10, 10, 'F')
      doc.setTextColor(MAGENTA[0], MAGENTA[1], MAGENTA[2])
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
      doc.text(c[1], cx + 12, cy + 26)
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
      doc.text(c[0], cx + 12, cy + 42)
    })
    y += Math.ceil(cards.length / cols) * (ch + gap) + 8
  }

  // ---- About ----
  if (full.bio && full.bio.trim()) {
    ensure(80); section('О себе')
    doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
    const lines = doc.splitTextToSize(full.bio.trim(), W - M * 2)
    doc.text(lines, M, y); y += lines.length * 15 + 14
  }

  // ---- Interests (chips) ----
  if (tagNames.length) {
    ensure(60); section('Интересы')
    let cx = M, cy = y
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    tagNames.forEach((name) => {
      const w = doc.getTextWidth(name) + 20
      if (cx + w > W - M) { cx = M; cy += 26 }
      doc.setFillColor(255, 240, 252)
      doc.roundedRect(cx, cy - 12, w, 20, 10, 10, 'F')
      doc.setTextColor(MAGENTA[0], MAGENTA[1], MAGENTA[2])
      doc.text(name, cx + 10, cy + 2)
      cx += w + 8
    })
    y = cy + 26
  }

  // ---- Prompts ----
  const filled = PROMPTS.filter(([k]) => (full.prompts?.[k] || '').trim())
  if (filled.length) {
    ensure(60); section('Обо мне подробнее')
    filled.forEach(([k, label, color]) => {
      const txt = full.prompts[k].trim()
      const lines = doc.splitTextToSize(txt, W - M * 2 - 16)
      const blockH = 22 + lines.length * 13
      ensure(blockH + 8)
      doc.setFillColor(250, 250, 252)
      doc.roundedRect(M, y, W - M * 2, blockH, 8, 8, 'F')
      doc.setFillColor(color[0], color[1], color[2])
      doc.roundedRect(M, y, 3.5, blockH, 2, 2, 'F')
      doc.setTextColor(color[0], color[1], color[2])
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
      doc.text(label.toUpperCase(), M + 14, y + 15)
      doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
      doc.text(lines, M + 14, y + 29)
      y += blockH + 8
    })
  }

  // ---- Anthem ----
  if (full.anthem_url) {
    ensure(40); section('Мой гимн')
    doc.setFillColor(255, 240, 252)
    doc.roundedRect(M, y, W - M * 2, 30, 8, 8, 'F')
    doc.setTextColor(MAGENTA[0], MAGENTA[1], MAGENTA[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`♪  ${full.anthem_title || 'Мой трек'}`, M + 12, y + 19)
    y += 40
  }

  // ---- Footer on every page ----
  const pages = doc.internal.getNumberOfPages()
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]); doc.setLineWidth(0.8)
    doc.line(M, H - 40, W - M, H - 40)
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(`CupidBot · выгружено ${today}`, M, H - 26)
    doc.text(`${p} / ${pages}`, W - M, H - 26, { align: 'right' })
  }

  return doc
}

export async function downloadProfilePdf(payload, filename = 'cupidbot_profile.pdf') {
  const doc = await buildProfilePdf(payload)
  // Telegram in-app browser: a Blob URL opened in a new tab is the most reliable
  // way to let the user save/share; fall back to direct download elsewhere.
  doc.save(filename)
}
