import { useState, useRef, useEffect } from 'react'
import { api, mediaUrl, haptic } from '../lib/api'

/* ───────────────── Anthem: upload + trim + play ───────────────── */
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function AnthemEditor({ url, title, start, onChange, setToast }) {
  const [dur, setDur] = useState(0)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const fileRef = useRef(null)
  const stopT = useRef(null)
  const PREVIEW = 15

  useEffect(() => () => clearTimeout(stopT.current), [])

  async function pick(file) {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setToast('Файл больше 8 МБ'); return }
    setBusy(true)
    try {
      const res = await api.uploadAnthem(file)
      const full = mediaUrl(res.anthem_url)
      onChange({ url: res.anthem_url, fullUrl: full, title: title || file.name.replace(/\.[^.]+$/, '').slice(0, 60), start: 0 })
      haptic('success'); setToast('🎵 Гимн загружен — обрежь и сохрани')
    } catch (e) { setToast(e?.data?.detail || 'Не удалось загрузить') }
    setBusy(false)
  }

  function preview() {
    const a = audioRef.current; if (!a) return
    if (playing) { a.pause(); setPlaying(false); clearTimeout(stopT.current); return }
    a.currentTime = start || 0
    a.play().then(() => {
      setPlaying(true)
      stopT.current = setTimeout(() => { a.pause(); setPlaying(false) }, PREVIEW * 1000)
    }).catch(() => setToast('Не удалось воспроизвести'))
  }

  async function remove() {
    try { await api.deleteAnthem() } catch {}
    onChange(null); setPlaying(false)
  }

  const fullUrl = url ? mediaUrl(url) : null

  return (
    <div>
      {!url ? (
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[14px] text-white active:scale-[0.98] transition"
          style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)', opacity: busy ? 0.6 : 1 }}>
          <i className="ph-fill ph-music-notes-plus text-[18px]" /> {busy ? 'Загрузка…' : 'Добавить гимн (аудио)'}
        </button>
      ) : (
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,0,255,0.05)', border: '1px solid rgba(255,0,255,0.18)' }}>
          <audio ref={audioRef} src={fullUrl} preload="metadata" onLoadedMetadata={(e) => setDur(e.target.duration || 0)} />
          <div className="flex items-center gap-3">
            <button onClick={preview} className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 active:scale-90 transition" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
              <i className={'ph-fill ' + (playing ? 'ph-pause' : 'ph-play') + ' text-[18px]'} />
            </button>
            <input value={title || ''} onChange={(e) => onChange({ url, title: e.target.value.slice(0, 60), start })} placeholder="Название трека"
              className="flex-1 min-w-0 h-9 rounded-xl bg-white border border-[#e5e7eb] px-3 text-[13px] font-semibold outline-none" />
            <button onClick={remove} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#f3f4f6' }}><i className="ph-bold ph-trash text-[#EF4444] text-[16px]" /></button>
          </div>
          {dur > PREVIEW && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#9ca3af] mb-1">
                <span>С какого момента играть</span><span className="tabular-nums">{fmt(start || 0)} – {fmt(Math.min(dur, (start || 0) + PREVIEW))}</span>
              </div>
              <input type="range" min={0} max={Math.max(0, Math.floor(dur - PREVIEW))} value={start || 0}
                onChange={(e) => onChange({ url, title, start: +e.target.value })} className="w-full" style={{ accentColor: '#FF00FF' }} />
            </div>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f) }} />
    </div>
  )
}

// Playable anthem chip for the profile cover (taps to play 15s from start)
export function AnthemPlayer({ url, title, start, accent = '#fff' }) {
  const [playing, setPlaying] = useState(false)
  const a = useRef(null); const stopT = useRef(null)
  useEffect(() => () => { clearTimeout(stopT.current); a.current?.pause?.() }, [])
  if (!url) return null
  const toggle = (e) => {
    e?.stopPropagation?.()
    const el = a.current; if (!el) return
    if (playing) { el.pause(); setPlaying(false); clearTimeout(stopT.current); return }
    el.currentTime = start || 0
    el.play().then(() => { setPlaying(true); stopT.current = setTimeout(() => { el.pause(); setPlaying(false) }, 15000); haptic('light') }).catch(() => {})
  }
  return (
    <button onClick={toggle} className="flex items-center gap-2 min-w-0 active:scale-95 transition">
      <audio ref={a} src={mediaUrl(url)} preload="none" onEnded={() => setPlaying(false)} />
      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(4px)' }}>
        <i className={'ph-fill ' + (playing ? 'ph-pause' : 'ph-play') + ' text-[11px]'} style={{ color: accent }} />
      </span>
      {playing
        ? <span className="flex items-end gap-[2px] h-3.5">{[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 2.5, background: accent, borderRadius: 2, height: '40%', animation: `eq ${0.6 + (i % 3) * 0.25}s ease-in-out ${i * 0.12}s infinite`, transformOrigin: 'bottom' }} />)}</span>
        : <i className="ph-fill ph-music-notes text-[12px]" style={{ color: accent }} />}
      <span className="text-[11px] font-semibold truncate max-w-[150px]" style={{ color: 'rgba(255,255,255,0.85)' }}>{title || 'Мой гимн'}</span>
    </button>
  )
}

/* ───────────────── Profile prompts (red/green flags, prompts) ───────────────── */
export const PROMPT_DEFS = [
  { key: 'green_flags', label: 'Мои грин-флаги', icon: 'ph-leaf', color: '#10B981', ph: 'Что во мне точно понравится…' },
  { key: 'red_flags', label: 'Мои ред-флаги', icon: 'ph-flag', color: '#EF4444', ph: 'Честно предупреждаю…' },
  { key: 'ideal_date', label: 'Идеальное свидание', icon: 'ph-heart-straight', color: '#FF00FF', ph: 'Как проведём первый вечер…' },
  { key: 'looking_for', label: 'Что я ищу', icon: 'ph-magnifying-glass', color: '#3B82F6', ph: 'Отношения, дружба, общение…' },
  { key: 'weakness', label: 'Моя слабость', icon: 'ph-ice-cream', color: '#F59E0B', ph: 'Кофе, котики, мемы…' },
]

export function PromptsEditor({ prompts, onChange }) {
  const set = (k, v) => onChange({ ...prompts, [k]: v.slice(0, 120) })
  return (
    <div className="space-y-2.5">
      {PROMPT_DEFS.map((p) => (
        <div key={p.key} className="rounded-2xl p-3 bg-white border border-[#e5e7eb]">
          <div className="flex items-center gap-1.5 mb-1.5"><i className={'ph-fill ' + p.icon} style={{ color: p.color }} /><span className="text-[12.5px] font-bold text-[#0F0F13]">{p.label}</span><span className="text-[10px] text-[#9ca3af] ml-auto">необязательно</span></div>
          <input value={prompts?.[p.key] || ''} onChange={(e) => set(p.key, e.target.value)} placeholder={p.ph}
            className="w-full h-9 rounded-xl bg-[#FAFAFC] border border-[#eceef3] px-3 text-[13px] font-medium outline-none focus:border-[#FF00FF] transition" />
        </div>
      ))}
    </div>
  )
}

export function PromptsView({ prompts, dark }) {
  const filled = PROMPT_DEFS.filter((p) => prompts?.[p.key]?.trim())
  if (!filled.length) return null
  return (
    <div className="space-y-2">
      {filled.map((p) => (
        <div key={p.key} className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f0f1f5'}`, borderLeft: `3px solid ${p.color}` }}>
          <i className={'ph-fill ' + p.icon + ' text-[18px] mt-0.5 shrink-0'} style={{ color: p.color }} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: p.color }}>{p.label}</div>
            <div className="text-[14px] font-medium mt-0.5 break-words" style={{ color: dark ? '#e5e7eb' : '#374151' }}>{prompts[p.key]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
