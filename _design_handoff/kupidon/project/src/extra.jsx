/* ============================================================
   CupidBot — Verification + Pricing
   ============================================================ */
const { useState: eUseState, useEffect: eUseEffect } = React;

const GESTURES = ['Коснись щеки 👆', 'Повернись влево ←', 'Улыбнись 😊', 'Подними руку ✋'];

function Verification({ onBack, onSuccess, pushToast }) {
  const [phase, setPhase] = eUseState('intro'); // intro | rec | ok | err
  const [gesture] = eUseState(GESTURES[Math.floor(Math.random() * GESTURES.length)]);

  const start = () => {
    setPhase('rec');
    setTimeout(() => setPhase(Math.random() < 0.85 ? 'ok' : 'err'), 2600);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'linear-gradient(180deg,#EFF6FF,#FAFAFC)' }}>
      <div className="safe-top screen-pad shrink-0 pt-1">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center active:scale-90 transition">
          <i className="ph-bold ph-arrow-left text-[18px] text-[#0F0F13]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center screen-pad">
        {phase === 'intro' && (
          <>
            <div className="relative flex items-center justify-center mb-7" style={{ width: 200, height: 200 }}>
              <div className="absolute inset-0 rounded-full" style={{ border: '3px dashed #93C5FD' }} />
              <div className="text-[80px]">🤳</div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-full text-[14px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)', boxShadow: '0 8px 20px -6px rgba(59,130,246,0.5)' }}>{gesture}</div>
            </div>
            <h1 className="text-[28px] font-black text-[#0F0F13] tracking-tight">Подтверди, что это ты</h1>
            <p className="mt-2 text-[14px] font-medium text-[#6b7280] px-4">Повтори жест. Кадры не сохраняются — только разовая сверка</p>
            <div className="w-full mt-8"><Button variant="blue" onClick={start}>📷 Начать</Button></div>
            <p className="mt-4 text-[13px] font-bold text-[#3B82F6]">✓ Получишь синюю галочку +15 к анкете</p>
          </>
        )}
        {phase === 'rec' && (
          <>
            <div className="relative flex items-center justify-center mb-7" style={{ width: 200, height: 200 }}>
              <div className="absolute inset-0 rounded-full" style={{ border: '3px solid #3B82F6', animation: 'pulseRing 1.5s infinite' }} />
              <div className="text-[80px]">🤳</div>
              <div className="absolute top-4 right-6 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                <span className="text-[11px] font-bold text-[#EF4444]">REC</span>
              </div>
            </div>
            <h1 className="text-[24px] font-black text-[#0F0F13]">Идёт проверка…</h1>
            <p className="mt-2 text-[14px] font-medium text-[#6b7280]">{gesture}</p>
          </>
        )}
        {phase === 'ok' && (
          <div className="anim-pop">
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
  );
}

/* ---------------- PRICING ---------------- */
const TIERS = [
  { id: 'free', name: 'Free', emoji: '', accent: '#9ca3af', badge: null,
    rows: ['50 свайпов/день', '0 суперлайков', 'Врыв за ⭐', '15 смс до TG', 'Без отката', 'Кто смотрел — силуэт'] },
  { id: 'premium', name: 'Premium', emoji: '💎', accent: '#FF00FF', badge: 'Выбор 80%',
    rows: ['200 свайпов/день', '5 суперлайков/день', '3 врыва/день', '5 смс до TG', 'Откат свайпа ✓', 'Кто смотрел — открыто'] },
  { id: 'kupidon', name: 'Kupidon', emoji: '👑', accent: '#FFD700', badge: 'VIP',
    rows: ['500 свайпов/день', '5+ суперлайков', '15 врывов/день', 'TG сразу', 'Откат свайпа ✓', 'Режим Олигарх ✓'] },
];
const STARS = [
  { label: 'Написать без мэтча', price: 50, emoji: '💌' },
  { label: 'Буст анкеты 2 часа', price: 100, emoji: '🚀' },
  { label: 'Разовый суперлайк', price: 150, emoji: '⭐' },
  { label: 'VIP-сигнал (Олигарх)', price: 500, emoji: '👑' },
];

function Pricing({ onBack, currentPlan, onSelectPlan, pushToast }) {
  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={VIBES.berry} grainOpacity={0.05} />
      <div className="relative z-10 w-full h-full overflow-y-auto noscroll">
      <div className="safe-top screen-pad pb-8">
        <div className="flex items-center gap-3 pt-1 pb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-white/60 flex items-center justify-center active:scale-90 transition shrink-0">
            <i className="ph-bold ph-x text-[18px] text-[#0F0F13]" />
          </button>
          <h1 className="text-[24px] font-black tracking-tight text-[#0F0F13]">Стань Купидоном 💘</h1>
        </div>

        <div className="space-y-3">
          {TIERS.map((t) => {
            const isKupidon = t.id === 'kupidon';
            const isPremium = t.id === 'premium';
            const current = currentPlan === t.id;
            return (
              <div key={t.id} className="rounded-3xl p-4 relative overflow-hidden"
                style={{
                  background: isKupidon ? 'linear-gradient(150deg,#1a1505,#0d0d0d)' : '#fff',
                  border: isPremium ? '2px solid #FF00FF' : isKupidon ? '1.5px solid rgba(255,215,0,0.4)' : '1.5px solid #e5e7eb',
                  boxShadow: isPremium ? '0 12px 30px -12px rgba(255,0,255,0.3)' : isKupidon ? '0 12px 30px -12px rgba(255,215,0,0.25)' : 'none',
                }}>
                {t.badge && (
                  <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-black" style={{ background: isKupidon ? 'rgba(255,215,0,0.18)' : 'rgba(255,0,255,0.12)', color: t.accent }}>{t.badge}</span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[20px] font-black" style={{ color: isKupidon ? '#FFD700' : '#0F0F13' }}>{t.name}</span>
                  <span className="text-[18px]">{t.emoji}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
                  {t.rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: isKupidon ? '#cfc6a8' : '#374151' }}>
                      <i className="ph-bold ph-check text-[12px]" style={{ color: t.accent }} /> {r}
                    </div>
                  ))}
                </div>
                {t.id !== 'free' && (
                  current ? (
                    <div className="h-12 rounded-2xl flex items-center justify-center text-[14px] font-bold" style={{ background: isKupidon ? 'rgba(255,215,0,0.1)' : 'rgba(255,0,255,0.08)', color: t.accent }}>Текущий план ✓</div>
                  ) : isKupidon ? (
                    <Button variant="gold" onClick={() => { onSelectPlan('kupidon'); pushToast('👑 Kupidon активирован'); }} className="w-full">Оформить Kupidon</Button>
                  ) : (
                    <Button onClick={() => { onSelectPlan('premium'); pushToast('💎 Premium активирован'); }} className="w-full">Оформить Premium</Button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* one-time stars */}
        <h2 className="text-[18px] font-black text-[#0F0F13] mt-6 mb-3 px-1">Разовые покупки ⭐</h2>
        <div className="grid grid-cols-2 gap-3">
          {STARS.map((s) => (
            <button key={s.label} onClick={() => pushToast(`Покупка: ${s.label} — ${s.price}⭐`)} className="rounded-2xl p-3.5 text-left bg-white border border-[#e5e7eb] active:scale-95 transition">
              <div className="text-[24px] mb-1">{s.emoji}</div>
              <div className="text-[13px] font-bold text-[#0F0F13] leading-tight">{s.label}</div>
              <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-black" style={{ background: 'rgba(255,215,0,0.15)', color: '#B8860B' }}>{s.price} ⭐</div>
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

Object.assign(window, { Verification, Pricing });
