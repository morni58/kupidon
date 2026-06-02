import { useState } from 'react'
import { api, haptic } from '../lib/api'

const REASONS = [
  { id: 'fake', label: 'Фейк / не тот человек', icon: 'ph-user-circle-dashed' },
  { id: 'spam', label: 'Спам / реклама', icon: 'ph-megaphone' },
  { id: 'abuse', label: 'Оскорбления / агрессия', icon: 'ph-hand-fist' },
  { id: 'nsfw', label: 'Непристойный контент', icon: 'ph-warning-octagon' },
  { id: 'underage', label: 'Несовершеннолетний', icon: 'ph-baby' },
  { id: 'fraud', label: 'Мошенничество / просит денег', icon: 'ph-currency-circle-dollar' },
]

// Bottom-sheet report form: reason + free text. Used from chat & profile.
export function ReportSheet({ open, targetId, matchId, onClose, setToast }) {
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!reason) { setToast('Выбери причину'); return }
    setBusy(true)
    try {
      await api.report(targetId, reason, note.trim() || null, matchId || null)
      haptic('success'); setToast('⚠️ Жалоба отправлена. Спасибо!')
      setReason(null); setNote(''); onClose?.()
    } catch (e) {
      setToast(e?.data?.detail === 'Already reported' ? 'Ты уже жаловался на этого человека' : 'Не удалось отправить')
    }
    setBusy(false)
  }

  return (
    <div className={'absolute inset-0 z-50 transition-all duration-300 ' + (open ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div className="absolute inset-0 transition-opacity duration-300" style={{ background: 'rgba(0,0,0,0.6)', opacity: open ? 1 : 0 }} onClick={onClose} />
      <div className="absolute left-0 right-0 bottom-0 transition-transform duration-300"
        style={{ transform: open ? 'translateY(0)' : 'translateY(110%)', background: '#fff', borderTopLeftRadius: '2rem', borderTopRightRadius: '2rem', padding: '12px 20px calc(env(safe-area-inset-bottom) + 24px)', boxShadow: '0 -20px 50px rgba(0,0,0,0.25)' }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: '#d1d5db' }} />
        <h2 className="text-[20px] font-black text-[#0F0F13]">Пожаловаться</h2>
        <p className="text-[13px] text-[#6b7280] mt-0.5 mb-3">Опиши, что не так — модерация увидит причину, твою заметку и контекст переписки.</p>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto noscroll">
          {REASONS.map((r) => (
            <button key={r.id} onClick={() => { setReason(r.id); haptic('light') }}
              className="w-full flex items-center gap-3 px-3.5 h-12 rounded-2xl transition active:scale-[0.99]"
              style={{ background: reason === r.id ? 'rgba(239,68,68,0.08)' : '#FAFAFC', border: `1.5px solid ${reason === r.id ? '#EF4444' : '#eceef3'}` }}>
              <i className={'ph-bold ' + r.icon + ' text-[18px]'} style={{ color: reason === r.id ? '#EF4444' : '#9ca3af' }} />
              <span className="text-[14px] font-semibold text-[#0F0F13] text-left flex-1">{r.label}</span>
              {reason === r.id && <i className="ph-fill ph-check-circle text-[#EF4444] text-[18px]" />}
            </button>
          ))}
        </div>
        <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Что именно произошло? (необязательно)"
          className="w-full mt-3 rounded-2xl bg-[#FAFAFC] border border-[#eceef3] focus:border-[#EF4444] outline-none p-3 text-[14px] resize-none transition" />
        <button onClick={submit} disabled={busy} className="w-full mt-3 h-13 py-3.5 rounded-2xl font-bold text-white text-[15px] active:scale-[0.98] transition"
          style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Отправляем…' : 'Отправить жалобу'}
        </button>
      </div>
    </div>
  )
}
