import { useState, useEffect, useRef } from 'react'
import { MeshBG, THEME_MESH, VIBES, VIBE_LIST, ScoreRing, Equalizer, Grain, hexA } from '../design/fx'
import { Photo, Button, Toggle, Pill, VerifiedTick, TabBar, Confetti } from '../design/ui'
import { ageFromBirth, birthFromAge, gradPhoto, interestById } from '../design/data'
import { api, haptic, openInvoice, mediaUrl } from '../lib/api'
import { SkeletonProfile } from '../design/loaders'
import { useStore } from '../lib/store'
import { AgeDial, PhotoGrid } from './Onboarding'
import { AnthemEditor, AnthemPlayer, PromptsEditor, PromptsView } from './ProfileExtras'

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

export function Profile({ theme, palette: paletteProp, accent: accentProp, dark: darkProp, plan, prefs, setPref, onVerify, onUpgrade, onMutate, onEdit, onDeleted, setToast, active, onTab, dots }) {
  const [full, setFull] = useState(() => useStore.getState().meFullCache || null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [confirmDel, setConfirmDel] = useState(false)
  const scrollRef = useRef(null)

  async function exportData() {
    try {
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'cupidbot_data.json'; a.click()
      URL.revokeObjectURL(url); setToast('📦 Данные выгружены')
    } catch { setToast('Не удалось выгрузить') }
  }
  async function deleteAccount() {
    try { await api.deleteAccount(); haptic('warning'); onDeleted?.() }
    catch { setToast('Не удалось удалить') }
  }

  const load = () => api.getMeFull().then((f) => { setFull(f); useStore.setState({ meFullCache: f }) }).catch(() => {})
  useEffect(() => { load() }, [])

  if (!full) return <SkeletonProfile dark={darkProp} />

  const dark = darkProp != null ? darkProp : (theme === 'oligarch' || theme === 'adult')
  const vibe = VIBES[prefs.vibe] || VIBES.neon
  const accent = accentProp || vibe.accent
  const palette = paletteProp || (theme === 'light' ? vibe : THEME_MESH[theme])
  const verified = full.is_verified
  const age = ageFromBirth(full.birth_date)
  const photos = (full.media && full.media.length ? full.media.map((url) => ({ url: mediaUrl(url) })) : [gradPhoto((full.name || '?').charCodeAt(0), '😎')])

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
        <div className="relative" style={{ height: 'clamp(360px, 54vh, 460px)' }}>
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '0 0 2rem 2rem', transform: `translateY(${scrollY * 0.3}px) scale(${1 + scrollY * 0.0004})`, transformOrigin: 'top' }}>
            <Photo data={photos[photoIdx]} rounded="0 0 2rem 2rem" className="w-full h-full" emojiSize={172} />
            <Grain opacity={0.08} blend="overlay" />
          </div>
          {frameGlow && <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '0 0 2rem 2rem', boxShadow: `inset 0 0 80px ${hexA(accent, 0.45)}, inset 0 -2px 0 ${hexA(accent, 0.5)}` }} />}
          <div className="absolute top-3 left-3 right-3 flex gap-1.5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {photos.map((_, i) => <div key={i} className="flex-1 rounded-full" style={{ height: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: i === photoIdx ? '0 0 8px #fff' : 'none' }} />)}
          </div>
          <button onClick={onEdit} className="absolute z-20 right-3 flex items-center gap-1.5 px-3 h-9 rounded-full font-bold text-[13px] active:scale-95 transition"
            style={{ top: 'calc(env(safe-area-inset-top) + 12px)', background: 'rgba(255,255,255,0.92)', color: '#0F0F13', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
            <i className="ph-bold ph-pencil-simple" /> Изменить
          </button>
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
              {full.anthem_url && <AnthemPlayer url={full.anthem_url} title={full.anthem_title} start={full.anthem_start} accent="#fff" />}
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

            {/* Тема (визуальная, не зависит от 18+) */}
            <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: sub }}>Тема</div>
            <div className="flex gap-2.5 mb-4">
              {[{ id: 'light', label: 'Светлая', emoji: '☀️' }, { id: 'dark', label: 'Тёмная', emoji: '🌙' }].map((th) => {
                const on = (prefs.uiTheme || 'light') === th.id
                return (
                  <button key={th.id} onClick={() => setPref({ uiTheme: th.id })} className="flex-1 rounded-2xl flex items-center justify-center gap-1.5 py-2.5 transition active:scale-95"
                    style={{ background: on ? hexA(accent, 0.14) : (dark ? 'rgba(255,255,255,0.05)' : '#fff'), border: `2px solid ${on ? accent : (dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb')}`, color: txt, fontWeight: 700, fontSize: 13 }}>
                    <span>{th.emoji}</span>{th.label}
                  </button>
                )
              })}
            </div>

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
              <div className="flex items-center gap-2"><i className="ph-fill ph-music-notes text-[16px]" style={{ color: accent }} /><span className="text-[13.5px] font-semibold" style={{ color: txt }}>Мой гимн (любимый трек)</span></div>
              <Toggle on={prefs.anthem} color={accent} onChange={(v) => setPref({ anthem: v })} />
            </div>
            {prefs.anthem && (
              <input value={prefs.anthemTrack || ''} onChange={(e) => setPref({ anthemTrack: e.target.value })} maxLength={60}
                placeholder="Исполнитель — Название трека"
                className="w-full mt-1 rounded-xl outline-none px-3 py-2.5 text-[13px] font-semibold"
                style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1.5px solid ${dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`, color: txt }} />
            )}
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
              <Glass dark={dark} className="p-4"><p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap break-words" style={{ color: dark ? '#ddd' : '#374151' }}>{full.bio}</p></Glass>
            </div>
          )}

          {/* prompts: red/green flags etc. */}
          {full.prompts && Object.values(full.prompts).some((v) => (v || '').trim()) && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: txt }}>Обо мне подробнее</h3>
              <PromptsView prompts={full.prompts} dark={dark} />
            </div>
          )}

          {/* toggles */}
          <Glass dark={dark} className="p-1 divide-y" style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-3 p-3.5">
              <span className="text-[22px]">🔞</span>
              <div className="flex-1"><div className="text-[15px] font-bold" style={{ color: txt }}>Комната 18+</div><div className="text-[12px] font-medium" style={{ color: sub }}>Только для verified</div></div>
              <Toggle on={full.is_18_mode_active} color="#FF3333" onChange={(v) => toggle('is_18_mode_active', v, (val) => val && age < 18 ? 'Режим 18+ доступен с 18 лет' : val && !verified ? '🔵 Сначала пройди верификацию' : null)} />
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

          {/* данные и приватность */}
          <Glass dark={dark} className="p-4">
            <div className="text-[14px] font-black mb-3" style={{ color: txt }}>Данные и приватность</div>
            <button onClick={exportData} className="w-full flex items-center gap-2.5 py-2.5 text-[14px] font-semibold" style={{ color: txt }}>
              <i className="ph-bold ph-download-simple" style={{ color: accent }} /> Скачать мои данные
            </button>
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="w-full flex items-center gap-2.5 py-2.5 text-[14px] font-semibold text-[#EF4444]">
                <i className="ph-bold ph-trash" /> Удалить аккаунт
              </button>
            ) : (
              <div className="mt-1 rounded-2xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="text-[13px] font-semibold text-[#EF4444] mb-2">Точно удалить? Анкета и фото исчезнут, это необратимо.</div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDel(false)} className="flex-1 h-10 rounded-xl bg-white border border-[#e5e7eb] text-[13px] font-bold text-[#6b7280]">Отмена</button>
                  <button onClick={deleteAccount} className="flex-1 h-10 rounded-xl text-[13px] font-bold text-white" style={{ background: '#EF4444' }}>Удалить</button>
                </div>
              </div>
            )}
          </Glass>
        </div>
      </div>
      <TabBar active={active} onTab={onTab} accent={accent} dark={dark} dots={dots} />
    </div>
  )
}

/* ---------------- PROFILE EDIT ---------------- */
export function ProfileEdit({ onBack, onSaved, setToast }) {
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [age, setAge] = useState(24)
  const [gender, setGender] = useState(null)
  const [looking, setLooking] = useState(null)
  const [bio, setBio] = useState('')
  const [photos, setPhotos] = useState([null, null, null, null, null])
  const [allTags, setAllTags] = useState([])
  const [tags, setTags] = useState([])
  const [city, setCity] = useState(null)
  const [citySearch, setCitySearch] = useState('')
  const [cityResults, setCityResults] = useState([])
  const [newTag, setNewTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [anthem, setAnthem] = useState(null)   // { url, title, start }
  const [prompts, setPrompts] = useState({})

  async function proposeTag() {
    const name = newTag.trim()
    if (name.length < 2) { setToast('Введи название тега'); return }
    try {
      await api.requestTag({ name })
      setNewTag(''); haptic('success'); setToast('✅ Заявка отправлена на модерацию')
    } catch (e) {
      const d = e?.data?.detail
      setToast(d === 'not_enough_stars' ? 'Недостаточно Stars (200⭐)'
        : d === 'Tag already exists' ? 'Такой тег уже есть'
        : d === 'Tag already requested' ? 'Уже на модерации'
        : (d || 'Ошибка'))
    }
  }

  useEffect(() => {
    Promise.all([
      api.getMeFull().catch(() => null),
      api.getTags().catch(() => []),
      api.myMediaSlots().catch(() => []),
    ]).then(([full, tagList, slots]) => {
      if (full) {
        setName(full.name || '')
        setAge(ageFromBirth(full.birth_date) || 24)
        setGender(full.gender || null)
        setLooking(full.search_gender || null)
        setBio(full.bio || '')
        setTags(full.tag_ids || [])
        if (full.city_name) setCity({ name: full.city_name })
        if (full.anthem_url) setAnthem({ url: full.anthem_url, title: full.anthem_title || '', start: full.anthem_start || 0 })
        setPrompts(full.prompts || {})
      }
      setAllTags(tagList)
      const arr = [null, null, null, null, null]
      for (const s of slots) { if (s.slot_index >= 1 && s.slot_index <= 5) arr[s.slot_index - 1] = { url: mediaUrl(s.media_url) } }
      setPhotos(arr)
      setLoaded(true)
    })
  }, [])

  const toggleTag = (id) => setTags((t) => t.includes(id) ? t.filter((x) => x !== id) : t.length >= 5 ? t : [...t, id])

  async function searchCity(q) {
    setCitySearch(q); setCity(null)
    if (q.length < 2) { setCityResults([]); return }
    try { setCityResults(await api.geoSearch(q)) } catch {}
  }
  async function pickCity(c) {
    try {
      if (c.id) await api.setCity(c.id)
      else await api.setPlace({ name: c.name, region: c.region, country: c.country || 'RU', lat: c.lat, lng: c.lng })
    } catch {}
    setCity(c); setCitySearch(''); setCityResults([])
  }
  async function useGPS() {
    if (!navigator.geolocation) { setToast('GPS недоступен'); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { const r = await api.geoResolve(pos.coords.latitude, pos.coords.longitude); setCity({ id: r.city_id, name: r.city_name || 'Местоположение' }); setToast('📍 ' + (r.city_name || 'Найдено')) }
      catch { setToast('Ошибка GPS') }
    }, () => setToast('Доступ к GPS запрещён'))
  }

  async function save() {
    if (name.trim().length < 2) { setToast('Введи имя'); return }
    setBusy(true)
    try {
      const patch = { name: name.trim(), birth_date: birthFromAge(age), bio: bio || '' }
      if (gender) patch.gender = gender
      if (looking) patch.search_gender = looking === 'all' ? 'any' : looking
      if (anthem) { patch.anthem_title = anthem.title || ''; patch.anthem_start = anthem.start || 0 }
      patch.prompts = prompts || {}
      await api.updateProfile(patch)
      await api.setTags(tags)
      haptic('success'); setToast('✅ Профиль обновлён'); onSaved?.()
    } catch (e) {
      setToast(e?.data?.detail === 'Must be 18+' ? 'Доступ с 18 лет' : (e?.data?.detail || 'Ошибка сохранения'))
    }
    setBusy(false)
  }

  if (!loaded) return <SkeletonProfile dark={darkProp} />

  const Section = ({ title, children }) => (
    <div className="mb-5"><h3 className="text-[14px] font-black text-[#0F0F13] mb-2.5">{title}</h3>{children}</div>
  )

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#FAFAFC' }}>
      <div className="safe-top shrink-0 flex items-center gap-3 px-4 pb-2" style={{ borderBottom: '1px solid #f3f4f6', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center active:scale-90 transition shrink-0"><i className="ph-bold ph-arrow-left text-[18px] text-[#0F0F13]" /></button>
        <h1 className="text-[18px] font-black text-[#0F0F13]">Редактировать профиль</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto noscroll screen-pad pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>
        <Section title="Фото"><PhotoGrid photos={photos} setPhotos={setPhotos} setToast={setToast} /></Section>

        <Section title="Имя">
          <input value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Zа-яА-ЯёЁ\s-]/g, ''))} placeholder="Имя"
            className="w-full h-13 rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none px-4 py-3.5 text-[16px] font-semibold text-[#0F0F13] transition" />
        </Section>

        <Section title="Возраст"><div style={{ height: 180 }}><AgeDial value={age} onChange={setAge} /></div></Section>

        <Section title="Пол">
          <div className="grid grid-cols-2 gap-3">
            {[{ id: 'male', label: 'Парень', emoji: '👨' }, { id: 'female', label: 'Девушка', emoji: '👩' }].map((g) => (
              <button key={g.id} onClick={() => setGender(g.id)} className="rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"
                style={{ height: 60, background: gender === g.id ? 'rgba(255,0,255,0.06)' : '#fff', border: `2px solid ${gender === g.id ? '#FF00FF' : '#e5e7eb'}` }}>
                <span className="text-[24px]">{g.emoji}</span><span className="text-[15px] font-bold text-[#0F0F13]">{g.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Кого ищешь">
          <div className="grid grid-cols-3 gap-2.5">
            {[{ id: 'male', label: 'Парня', emoji: '👨' }, { id: 'female', label: 'Девушку', emoji: '👩' }, { id: 'all', label: 'Всех', emoji: '💞' }].map((o) => {
              const sel = looking === o.id || (looking === 'any' && o.id === 'all')
              return (
                <button key={o.id} onClick={() => setLooking(o.id)} className="rounded-2xl flex flex-col items-center justify-center gap-1 transition active:scale-95"
                  style={{ height: 64, background: sel ? 'rgba(255,0,255,0.06)' : '#fff', border: `2px solid ${sel ? '#FF00FF' : '#e5e7eb'}` }}>
                  <span className="text-[22px]">{o.emoji}</span><span className="text-[12px] font-bold text-[#0F0F13]">{o.label}</span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Город">
          <button onClick={useGPS} className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-white mb-2.5" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}><i className="ph-fill ph-map-pin" /> Найти меня по GPS</button>
          <div className="relative">
            <i className="ph-bold ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input value={citySearch} onChange={(e) => searchCity(e.target.value)} placeholder="Введи город…"
              className="w-full h-12 rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none pl-11 pr-4 text-[15px] font-semibold text-[#0F0F13] transition" />
          </div>
          {citySearch && cityResults.length > 0 && (
            <div className="mt-2 bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden" style={{ maxHeight: 180, overflowY: 'auto' }}>
              {cityResults.map((c, i) => (
                <button key={c.id ?? `g${i}`} onClick={() => pickCity(c)} className="w-full px-4 py-2.5 flex items-center gap-2 active:bg-[#FAFAFC] border-b border-[#f3f4f6] last:border-0 text-left">
                  <div className="flex-1 min-w-0"><span className="text-[15px] font-bold text-[#0F0F13]">{c.name}</span> <span className="text-[12px] text-[#9ca3af]">{c.region}</span></div>
                  <i className="ph-bold ph-check text-[#FF00FF]" />
                </button>
              ))}
            </div>
          )}
          {city && <div className="mt-2.5 flex items-center gap-2 text-[15px] font-bold text-[#10B981]"><i className="ph-fill ph-check-circle text-[20px]" /> {city.name}</div>}
        </Section>

        <Section title="О себе">
          <div className="relative">
            <textarea value={bio} maxLength={300} onChange={(e) => setBio(e.target.value)} rows={5} placeholder="Расскажи о себе — чем живёшь, что любишь, какой ты…"
              className="w-full rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none p-4 text-[15px] font-medium text-[#0F0F13] resize-none transition" />
            <span className="absolute bottom-3 right-4 text-[12px] font-bold text-[#9ca3af]">{bio.length}/300</span>
          </div>
        </Section>

        <Section title="Подробнее о тебе">
          <p className="text-[12px] text-[#9ca3af] -mt-1 mb-2.5">Любые поля по желанию — так анкета живее и понятнее.</p>
          <PromptsEditor prompts={prompts} onChange={setPrompts} />
        </Section>

        <Section title="Мой гимн">
          <p className="text-[12px] text-[#9ca3af] -mt-1 mb-2.5">Загрузи короткий трек, выбери момент — он будет играть у тебя в профиле.</p>
          <AnthemEditor url={anthem?.url} title={anthem?.title} start={anthem?.start || 0}
            onChange={(a) => setAnthem(a ? { url: a.url, title: a.title, start: a.start } : null)} setToast={setToast} />
        </Section>

        <Section title={`Интересы (${tags.length}/5)`}>
          <div className="flex flex-wrap gap-2">
            {allTags.filter((t) => !t.is_18_only).map((t) => (
              <Pill key={t.id} interest={{ id: t.id, label: t.name, color: t.color_hex || '#FF00FF', emoji: t.emoji }}
                selected={tags.includes(t.id)} dim={!tags.includes(t.id) && tags.length >= 5} onClick={() => toggleTag(t.id)} small />
            ))}
          </div>
          {/* Предложить свой тег (платно, на модерацию) */}
          <div className="flex gap-2 mt-3">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={30} placeholder="Свой тег (на модерацию, 200⭐)"
              className="flex-1 rounded-xl outline-none px-3 py-2.5 text-[13px] font-semibold bg-white border border-[#e5e7eb] text-[#0F0F13]" />
            <Button size="sm" onClick={proposeTag}>Предложить</Button>
          </div>
        </Section>
      </div>

      <div className="shrink-0 px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #f3f4f6' }}>
        <Button disabled={busy} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>
      </div>
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
export function Pricing({ onBack, currentTier, setToast, onMutate, palette }) {
  async function buy(product) {
    if (!product) return
    try {
      const res = await api.createInvoice(product)
      if (res.invoice_link) {
        const st = await openInvoice(res.invoice_link)
        if (st === 'paid') { setToast('✅ Оплата прошла!'); onMutate?.() }
      } else {
        // No invoice link (Bot API/config issue) — tell the user honestly (UX16).
        setToast('⚠️ Оплата временно недоступна, попробуй позже')
      }
    } catch { setToast('Ошибка платежа') }
  }
  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette || VIBES.berry} grainOpacity={0.05} />
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
