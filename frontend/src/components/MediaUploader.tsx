import { useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

interface Slot { index: number; url?: string; uploading?: boolean }

interface Props {
  onChange?: (filledCount: number) => void
}

function haptic() { try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {} }

export function MediaUploader({ onChange }: Props) {
  const [slots, setSlots] = useState<Slot[]>([
    { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }, { index: 5 },
  ])
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  async function upload(slotIndex: number, file: File) {
    setSlots(s => s.map(x => x.index === slotIndex ? { ...x, uploading: true } : x))
    const token = localStorage.getItem('cupid_token')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API}/api/media/upload/${slotIndex}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.detail === 'Media flagged as NSFW' ? 'Фото отклонено модерацией' : 'Ошибка загрузки')
        setSlots(s => s.map(x => x.index === slotIndex ? { ...x, uploading: false } : x))
        return
      }
      const data = await res.json()
      const fullUrl = data.media_url.startsWith('http') ? data.media_url : API + data.media_url
      setSlots(s => {
        const next = s.map(x => x.index === slotIndex ? { ...x, url: fullUrl, uploading: false } : x)
        onChange?.(next.filter(x => x.url).length)
        return next
      })
      haptic()
    } catch {
      alert('Сеть недоступна')
      setSlots(s => s.map(x => x.index === slotIndex ? { ...x, uploading: false } : x))
    }
  }

  async function remove(slotIndex: number) {
    const token = localStorage.getItem('cupid_token')
    await fetch(`${API}/api/media/slot/${slotIndex}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    setSlots(s => {
      const next = s.map(x => x.index === slotIndex ? { index: x.index } : x)
      onChange?.(next.filter(x => x.url).length)
      return next
    })
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((slot, i) => (
        <div key={slot.index}
          className={`aspect-[3/4] rounded-2xl border-2 relative overflow-hidden ${slot.url ? 'border-[#FF00FF]' : 'border-dashed border-gray-300'}`}
          style={slot.url ? { backgroundImage: `url(${slot.url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
          {slot.index === 1 && !slot.url && (
            <span className="absolute top-1 left-2 text-[9px] font-bold text-gray-400">Главное</span>
          )}
          {slot.uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="w-6 h-6 border-2 border-[#FF00FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : slot.url ? (
            <button onClick={() => remove(slot.index)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center">✕</button>
          ) : (
            <button onClick={() => fileRefs.current[i]?.click()}
              className="absolute inset-0 flex items-center justify-center text-3xl text-gray-300">+</button>
          )}
          <input ref={el => fileRefs.current[i] = el} type="file" accept="image/*,video/*" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(slot.index, f) }} />
        </div>
      ))}
    </div>
  )
}
