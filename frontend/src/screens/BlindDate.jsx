import { useState, useEffect } from 'react'
import { MeshBG, VIBES } from '../design/fx'
import { Button, Pill } from '../design/ui'
import { registerTags } from '../design/data'
import { AnthemPlayer, PromptsView } from './ProfileExtras'
import { api, haptic } from '../lib/api'

const DARK = { base: '#0B0712', dark: true, accent: '#A855F7',
  blobs: [['#A855F7', 20, 16, 70, 0.3, 'mesh-a'], ['#FF00FF', 82, 28, 64, 0.28, 'mesh-b'], ['#6366F1', 46, 92, 76, 0.26, 'mesh-c'], ['#EC4899', 90, 82, 50, 0.2, 'mesh-a']] }

export function BlindDate({ onBack, onOpenChat, setToast }) {
  const [state, setState] = useState(null) // {status, partner, my_reveal, their_reveal, match_id}
  const [busy, setBusy] = useState(false)

  const load = () => api.blindToday().then(setState).catch(() => setState({ status: 'none' }))
  useEffect(() => { load(); const id = setInterval(load, 6000); return () => clearInterval(id) }, [])

  async function join() {
    setBusy(true)
    try {
      const r = await api.blindJoin(); haptic('medium')
      if (r.status === 'matched') { setToast('🎭 Пара найдена!'); await load() }
      else { setToast('Ищем тебе пару… загляни чуть позже 🌙'); setState({ status: 'waiting' }) }
    } catch (e) { setToast(e?.data?.detail || 'Не удалось') }
    setBusy(false)
  }
  async function reveal() {
    setBusy(true)
    try {
      const r = await api.blindReveal(); haptic('success')
      if (r.both) { setToast('🎉 Вы раскрылись!'); onOpenChat?.(r.match_id) }
      else { setToast('Ты раскрылся — ждём собеседника'); await load() }
    } catch (e) { setToast(e?.data?.detail || 'Не удалось') }
    setBusy(false)
  }

  const p = state?.partner
  if (p?.tags) registerTags(p.tags)

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={DARK} grainOpacity={0.12} />
      <div className="relative z-10 w-full h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="safe-top screen-pad pb-2 flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}><i className="ph-bold ph-arrow-left text-[18px] text-white" /></button>
          <h1 className="text-[24px] font-black tracking-tight text-white">Свидание вслепую 🎭</h1>
        </div>

        {/* NONE — invite */}
        {(!state || state.status === 'none') && (
          <div className="screen-pad flex flex-col items-center text-center pt-8">
            <div className="text-[88px] floaty">🎭</div>
            <h2 className="text-[26px] font-black text-white mt-2">Один незнакомец в день</h2>
            <p className="text-[15px] mt-2 px-4" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Мы подберём тебе человека по совместимости. Фото и имя скрыты — только вайб: музыка, интересы и пара честных строк. Понравитесь по душе — раскроетесь.
            </p>
            <div className="mt-6 w-full space-y-2 text-left">
              {[['ph-eye-slash', 'Без фото и имени — только личность'], ['ph-music-notes', 'Слышишь его гимн, читаешь флаги'], ['ph-heart-half', 'Раскрытие — только по взаимности']].map(([ic, t], i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <i className={'ph-fill ' + ic + ' text-[20px]'} style={{ color: '#C084FC' }} /><span className="text-[14px] font-semibold text-white">{t}</span>
                </div>
              ))}
            </div>
            <div className="w-full mt-7"><Button disabled={busy} onClick={join} style={{ background: 'linear-gradient(135deg,#A855F7,#EC4899)' }}>{busy ? 'Подбираем…' : '🎲 Найти незнакомца'}</Button></div>
          </div>
        )}

        {/* WAITING */}
        {state?.status === 'waiting' && (
          <div className="screen-pad flex flex-col items-center text-center pt-16">
            <div className="text-[80px] heartbeat">🔮</div>
            <h2 className="text-[24px] font-black text-white mt-3">Ищем тебе пару…</h2>
            <p className="text-[14px] mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Как только найдём подходящего человека — пришлём уведомление. Можно закрыть приложение.</p>
            <div className="mt-6 w-[150px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(168,85,247,0.2)' }}><div className="bar-sweep h-full w-1/3 rounded-full" style={{ background: 'linear-gradient(90deg,#A855F7,#EC4899)' }} /></div>
          </div>
        )}

        {/* MATCHED — blind card */}
        {state?.status === 'matched' && p && (
          <div className="screen-pad pt-2">
            <div className="rounded-[2rem] p-5 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 20px 50px -20px rgba(168,85,247,0.5)' }}>
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-[44px] mb-3" style={{ background: 'linear-gradient(135deg,#2a1545,#140a22)', border: '2px solid rgba(168,85,247,0.5)' }}>🕶️</div>
                <h2 className="text-[22px] font-black text-white">Незнакомец{p.age ? `, ${p.age}` : ''}</h2>
                {p.city && <p className="text-[13px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}><i className="ph-fill ph-map-pin" /> {p.city}</p>}
                {p.anthem_url && <div className="mt-2"><AnthemPlayer url={p.anthem_url} title={p.anthem_title} start={p.anthem_start} accent="#C084FC" /></div>}
              </div>
              {p.tags?.length > 0 && <div className="flex flex-wrap gap-2 justify-center mt-3">{p.tags.map((t) => <Pill key={t.id} interest={{ id: t.id, label: t.name, color: t.color_hex || '#A855F7', emoji: t.emoji }} selected small />)}</div>}
              {p.bio && <p className="text-[14px] text-center mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>«{p.bio}»</p>}
            </div>

            {p.prompts && Object.values(p.prompts).some((v) => (v || '').trim()) && (
              <div className="mt-3"><PromptsView prompts={p.prompts} dark /></div>
            )}

            <div className="mt-4 space-y-2">
              <Button disabled={busy} onClick={() => onOpenChat?.(state.match_id)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}><i className="ph-fill ph-chat-circle" /> Общаться вслепую</Button>
              <Button disabled={busy || state.my_reveal} onClick={reveal} style={{ background: state.my_reveal ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#A855F7,#EC4899)', color: '#fff' }}>
                {state.my_reveal ? (state.their_reveal ? '🎉 Раскрыты!' : '⏳ Ждём собеседника…') : '❤️ Раскрыться'}
              </Button>
              {state.their_reveal && !state.my_reveal && <p className="text-center text-[12px] font-bold" style={{ color: '#C084FC' }}>Собеседник уже раскрылся! Твой ход 👀</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
