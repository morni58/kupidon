import { useState, useEffect, useRef } from 'react'
import { MeshBG, VIBES, hexA } from '../design/fx'
import { Button } from '../design/ui'
import { api, haptic } from '../lib/api'
import { SkeletonRows } from '../design/loaders'

function StatCard({ icon, color, value, label, sub, big }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf, start; const target = typeof value === 'number' ? value : 0; const dur = 700
    const step = (t) => { if (!start) start = t; const k = Math.min(1, (t - start) / dur); setN(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [value])
  const display = typeof value === 'number' ? n : value
  return (
    <div className={'rounded-3xl p-4 ' + (big ? 'col-span-2' : '')} style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(14px)', boxShadow: '0 10px 30px -18px rgba(0,0,0,0.18)' }}>
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-2" style={{ background: hexA(color, 0.14) }}><i className={'ph-fill ' + icon + ' text-[18px]'} style={{ color }} /></div>
      <div className="text-[26px] font-black leading-none" style={{ color: '#0F0F13' }}>{display}{sub ? <span className="text-[14px] font-bold text-[#9ca3af]"> {sub}</span> : null}</div>
      <div className="text-[12px] font-semibold text-[#6b7280] mt-1">{label}</div>
    </div>
  )
}

export function Stats({ palette, onBack, setToast }) {
  const [s, setS] = useState(null)
  useEffect(() => { api.accountStats().then(setS).catch(() => setToast?.('Не удалось загрузить статистику')) }, [])

  async function exportJson() {
    try {
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'cupidbot_data.json'; a.click()
      URL.revokeObjectURL(url); haptic('success'); setToast?.('📦 Данные выгружены')
    } catch { setToast?.('Не удалось выгрузить') }
  }

  const trollScore = s ? Math.min(100, (s.city_changes * 12) + (s.gender_changes * 25)) : 0

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette || VIBES.neon} grainOpacity={0.05} />
      <div className="relative z-10 w-full h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="safe-top screen-pad pb-2 flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-white/60 flex items-center justify-center active:scale-90 transition shrink-0"><i className="ph-bold ph-arrow-left text-[18px] text-[#0F0F13]" /></button>
          <h1 className="text-[24px] font-black tracking-tight text-[#0F0F13]">Моя статистика 📊</h1>
        </div>

        {!s ? <div className="screen-pad"><SkeletonRows count={4} /></div> : (
          <div className="screen-pad pt-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="ph-heart" color="#FF00FF" value={s.likes_received} label="Тебя лайкнули" />
              <StatCard icon="ph-hand-heart" color="#FF66CC" value={s.likes_given} label="Ты лайкнул(а)" />
              <StatCard icon="ph-sparkle" color="#A855F7" value={s.matches} label="Совпадений" />
              <StatCard icon="ph-percent" color="#10B981" value={s.match_rate} sub="%" label="Конверсия в мэтч" />
              <StatCard icon="ph-eye" color="#3B82F6" value={s.views_received} label="Просмотров анкеты" />
              <StatCard icon="ph-chat-circle" color="#0EA5E9" value={s.messages_sent} label="Сообщений" />
              <StatCard icon="ph-cards" color="#F59E0B" value={s.total_swipes} label="Всего свайпов" />
              <StatCard icon="ph-flame" color="#FF7849" value={s.streak_days} sub="дн." label="Серия входов" />
            </div>

            {/* attractiveness + trust */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="ph-gauge" color="#FF00FF" value={s.profile_score} sub="%" label="Привлекательность" />
              <StatCard icon="ph-shield-check" color="#10B981" value={s.trust_score} sub="%" label="Уровень доверия" />
            </div>

            {/* anti-troll panel */}
            <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(150deg,#1c1708,#0c0c0c)', border: '1px solid rgba(255,215,0,0.3)' }}>
              <div className="flex items-center gap-2 mb-2"><span className="text-[18px]">🕵️</span><span className="text-[14px] font-black" style={{ color: '#FFD700' }}>Детектор перевоплощений</span></div>
              <div className="flex gap-3">
                <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>
                  <div className="text-[22px] font-black text-white">{s.city_changes}</div>
                  <div className="text-[11px] font-semibold" style={{ color: '#c9b870' }}>смен города</div>
                </div>
                <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>
                  <div className="text-[22px] font-black text-white">{s.gender_changes}</div>
                  <div className="text-[11px] font-semibold" style={{ color: '#c9b870' }}>смен пола</div>
                </div>
                <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>
                  <div className="text-[22px] font-black" style={{ color: trollScore > 50 ? '#FF6B6B' : '#10B981' }}>{trollScore > 50 ? '🤡' : '😇'}</div>
                  <div className="text-[11px] font-semibold" style={{ color: '#c9b870' }}>{trollScore > 50 ? 'подозрительно' : 'честный'}</div>
                </div>
              </div>
              <p className="text-[11px] mt-2" style={{ color: '#8a7a4a' }}>Чем чаще меняешь город/пол — тем выше «троль-скор». Честным анкетам — больше охвата.</p>
            </div>

            <div className="rounded-3xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.7)' }}>
              <div className="text-[13px] font-semibold text-[#6b7280]">С нами уже</div>
              <div className="text-[28px] font-black" style={{ color: '#FF00FF' }}>{s.days_with_us} {s.days_with_us === 1 ? 'день' : 'дн.'}</div>
            </div>

            <Button variant="secondary" onClick={exportJson} className="w-full"><i className="ph-bold ph-download-simple" /> Выгрузить все мои данные</Button>
          </div>
        )}
      </div>
    </div>
  )
}
