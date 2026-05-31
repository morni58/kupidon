import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useStore } from '../store'
import { MediaUploader } from '../components/MediaUploader'

type Step = 'name' | 'birth' | 'gender' | 'looking' | 'geo' | 'photo' | 'tags' | 'bio' | 'done'

const GENDERS = [{ v: 'male', l: 'Парень 👨' }, { v: 'female', l: 'Девушка 👩' }]
const LOOKING = [{ v: 'male', l: 'Парня' }, { v: 'female', l: 'Девушку' }, { v: 'any', l: 'Всех' }]

function haptic() { try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {} }

export function Onboarding() {
  const navigate = useNavigate()
  const setUser = useStore(s => s.setUser)
  const [step, setStep] = useState<Step>('name')
  const [form, setForm] = useState({ name: '', birth_date: '', gender: '', search_gender: '', bio: '', tag_ids: [] as number[] })
  const [tags, setTags] = useState<any[]>([])
  const [error, setError] = useState('')
  const [photoCount, setPhotoCount] = useState(0)
  const [geoStatus, setGeoStatus] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [cityResults, setCityResults] = useState<any[]>([])
  const [cityName, setCityName] = useState('')

  function next(s: Step) { haptic(); setStep(s) }
  function nameValid(n: string) { return /^[a-zA-Zа-яА-ЯёЁ\s\-]{2,30}$/.test(n) }
  function getAge(d: string) {
    const bd = new Date(d); const now = new Date()
    return now.getFullYear() - bd.getFullYear() -
      ((now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) ? 1 : 0)
  }

  function goGeo() { haptic(); next('geo') }

  async function useGPS() {
    setGeoStatus('Определяем...')
    if (!navigator.geolocation) { setGeoStatus('GPS недоступен'); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await api.post<any>('/api/geo/resolve', { lat: pos.coords.latitude, lng: pos.coords.longitude })
        setCityName(res.city_name || 'Местоположение сохранено')
        setGeoStatus('')
      } catch { setGeoStatus('Ошибка') }
    }, () => setGeoStatus('Доступ к GPS запрещён'))
  }

  async function searchCity(q: string) {
    setCitySearch(q)
    if (q.length < 2) { setCityResults([]); return }
    try { setCityResults(await api.get<any[]>(`/api/geo/search?q=${encodeURIComponent(q)}`)) } catch {}
  }

  async function pickCity(c: any) {
    try {
      await api.post(`/api/geo/set_city/${c.id}`)
      setCityName(c.name); setCityResults([]); setCitySearch(c.name)
    } catch {}
  }

  async function loadTags() {
    try { setTags(await api.get<any[]>('/api/tags')) } catch {}
    next('tags')
  }

  async function submit() {
    setError('')
    try {
      const user = await api.post<any>('/api/onboarding', {
        name: form.name,
        birth_date: form.birth_date,
        gender: form.gender,
        search_gender: form.search_gender,
        bio: form.bio || undefined,
      })
      if (form.tag_ids.length > 0) {
        await api.post('/api/profile/tags', form.tag_ids)
      }
      setUser(user)
      navigate('/feed')
    } catch (e: any) {
      setError(e.message || 'Ошибка')
    }
  }

  const slide = { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -100, opacity: 0 } }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <motion.div className="h-full rounded-full"
          style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}
          animate={{ width: `${({ name: 12, birth: 24, gender: 36, looking: 48, geo: 60, photo: 72, tags: 86, bio: 100, done: 100 }[step])}%` }}
          transition={{ type: 'spring' }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} {...slide} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex-1 flex flex-col justify-center px-8 py-6">

          {step === 'name' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Как тебя зовут?</h1>
              <p className="text-gray-400 mb-6">Только имя — без фамилии</p>
              <input value={form.name} maxLength={30}
                onChange={e => { const v = e.target.value.replace(/[^a-zA-Zа-яА-ЯёЁ\s\-]/g, ''); setForm(f => ({ ...f, name: v })) }}
                placeholder="Имя" autoFocus
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-[#FF00FF]" />
              <button disabled={!nameValid(form.name)}
                onClick={() => next('birth')}
                className="mt-6 w-full py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>Далее →</button>
            </div>
          )}

          {step === 'birth' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Дата рождения</h1>
              <input type="date" value={form.birth_date}
                onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-[#FF00FF]" />
              {form.birth_date && getAge(form.birth_date) < 18 && (
                <p className="text-red-500 font-bold mt-2">⚠️ Доступ с 18 лет</p>
              )}
              <button disabled={!form.birth_date || getAge(form.birth_date) < 18}
                onClick={() => next('gender')}
                className="mt-6 w-full py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>Далее →</button>
            </div>
          )}

          {step === 'gender' && (
            <div>
              <h1 className="text-3xl font-black mb-6">Кто ты?</h1>
              <div className="grid grid-cols-2 gap-4">
                {GENDERS.map(g => (
                  <button key={g.v} onClick={() => { setForm(f => ({ ...f, gender: g.v })); next('looking') }}
                    className={`py-6 rounded-2xl text-xl font-bold border-2 transition-all ${form.gender === g.v ? 'border-[#FF00FF] bg-fuchsia-50' : 'border-gray-200'}`}>
                    {g.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'looking' && (
            <div>
              <h1 className="text-3xl font-black mb-6">Кого ищешь?</h1>
              <div className="space-y-3">
                {LOOKING.map(g => (
                  <button key={g.v} onClick={() => { setForm(f => ({ ...f, search_gender: g.v })); goGeo() }}
                    className={`w-full py-4 rounded-2xl text-lg font-bold border-2 transition-all ${form.search_gender === g.v ? 'border-[#FF00FF] bg-fuchsia-50' : 'border-gray-200'}`}>
                    {g.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'geo' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Где ты?</h1>
              <p className="text-gray-400 mb-6">Чтобы показывать людей рядом</p>
              <button onClick={useGPS}
                className="w-full py-4 rounded-2xl text-white font-bold text-lg mb-4"
                style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
                📍 Найти меня (GPS)
              </button>
              {geoStatus && <p className="text-center text-sm text-gray-400 mb-2">{geoStatus}</p>}
              <div className="relative">
                <input value={citySearch} onChange={e => searchCity(e.target.value)}
                  placeholder="или введи город..."
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-semibold focus:outline-none focus:border-[#FF00FF]" />
                {cityResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-2xl mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {cityResults.map(c => (
                      <button key={c.id} onClick={() => pickCity(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-fuchsia-50 text-sm font-medium">
                        {c.name} <span className="text-gray-400 text-xs">{c.region}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {cityName && <p className="mt-3 text-emerald-600 font-bold text-sm">✓ {cityName}</p>}
              <button onClick={() => next('photo')}
                className="mt-6 w-full py-4 rounded-2xl font-bold text-lg border-2 border-gray-200 text-gray-600">
                {cityName ? 'Далее →' : 'Пропустить'}
              </button>
            </div>
          )}

          {step === 'photo' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Добавь фото</h1>
              <p className="text-gray-400 mb-4">Первое фото обязательно. До 5 слотов.</p>
              <MediaUploader onChange={setPhotoCount} />
              <button disabled={photoCount < 1} onClick={() => loadTags()}
                className="mt-6 w-full py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
                {photoCount < 1 ? 'Добавь хотя бы 1 фото' : 'Далее →'}
              </button>
            </div>
          )}

          {step === 'tags' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Интересы</h1>
              <p className="text-gray-400 mb-4">Выбери до 5 тегов</p>
              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                {tags.filter(t => !t.is_18_only).map(t => {
                  const sel = form.tag_ids.includes(t.id)
                  return (
                    <button key={t.id}
                      onClick={() => {
                        if (sel) setForm(f => ({ ...f, tag_ids: f.tag_ids.filter(id => id !== t.id) }))
                        else if (form.tag_ids.length < 5) setForm(f => ({ ...f, tag_ids: [...f.tag_ids, t.id] }))
                        haptic()
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${sel ? 'text-white' : 'text-gray-700 bg-white'}`}
                      style={{ borderColor: t.color_hex, background: sel ? t.color_hex : undefined }}>
                      {t.emoji} {t.name}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => next('bio')}
                className="mt-6 w-full py-4 rounded-2xl text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>Далее →</button>
            </div>
          )}

          {step === 'bio' && (
            <div>
              <h1 className="text-3xl font-black mb-2">О себе</h1>
              <p className="text-gray-400 mb-4">Необязательно, но +10% к горячести</p>
              <textarea value={form.bio} maxLength={150}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Расскажи немного о себе..." rows={4}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 font-semibold resize-none focus:outline-none focus:border-[#FF00FF]" />
              <p className="text-right text-xs text-gray-400 mt-1">{form.bio.length}/150</p>
              {error && <p className="text-red-500 font-bold text-sm mt-2">{error}</p>}
              <button onClick={submit}
                className="mt-4 w-full py-4 rounded-2xl text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
                🚀 В ленту!
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
