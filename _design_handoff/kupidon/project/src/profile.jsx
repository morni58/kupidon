/* ============================================================
   CupidBot — Profile (rich, customizable showcase)
   mesh atmosphere · score ring · vibe customization · anthem
   ============================================================ */
const { useState: pUseState, useEffect: pUseEffect, useRef: pUseRef } = React;

function Glass({ children, className = '', dark = false, style = {} }) {
  return (
    <div className={'rounded-3xl ' + className}
      style={{ background: dark ? 'rgba(26,26,29,0.72)' : 'rgba(255,255,255,0.72)',
        border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px) saturate(1.2)', WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        boxShadow: dark ? '0 8px 30px -16px rgba(0,0,0,0.6)' : '0 10px 30px -18px rgba(0,0,0,0.18)', ...style }}>
      {children}
    </div>
  );
}

function PlanTag({ plan }) {
  const map = {
    free: { bg: 'rgba(255,255,255,0.25)', fg: '#fff' },
    premium: { bg: 'rgba(255,0,255,0.9)', fg: '#fff' },
    kupidon: { bg: 'linear-gradient(135deg,#FFE259,#FFA751)', fg: '#0F0F13' },
  };
  const m = map[plan.id];
  return <span className="inline-flex items-center rounded-full font-bold" style={{ background: m.bg, color: m.fg, fontSize: 11.5, padding: '3px 10px', backdropFilter: 'blur(6px)' }}>{plan.badge}</span>;
}

function AnimNum({ value, className, style }) {
  const [n, setN] = pUseState(0);
  pUseEffect(() => {
    let raf, start; const dur = 800;
    const step = (t) => { if (!start) start = t; const k = Math.min(1, (t - start) / dur); setN(Math.round(value * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className} style={style}>{n}</span>;
}

function Profile({ user, theme, plan, gender, settings, setSettings, onVerify, onUpgrade, openViewers, openTariffs, active, onTab, dots, pushToast }) {
  const dark = theme === 'oligarch' || theme === 'adult';
  const themeAccent = theme === 'oligarch' ? '#FFD700' : theme === 'adult' ? '#FF3333' : null;
  const vibe = VIBES[settings.vibe] || VIBES.neon;
  const accent = themeAccent || vibe.accent;
  const palette = theme === 'light' ? vibe : THEME_MESH[theme];
  const [photoIdx, setPhotoIdx] = pUseState(0);
  const scrollRef = pUseRef(null);
  const [scrollY, setScrollY] = pUseState(0);
  const photos = user.photos.filter(Boolean);
  const verified = settings.verified;

  let score = 0;
  if (photos.length >= 1) score += 20;
  score += Math.min(photos.length - 1, 3) * 10;
  if (user.bio) score += 10;
  if (user.tags.length >= 3) score += 10;
  if (verified) score += 15;
  score = Math.min(100, score);

  const txt = dark ? '#fff' : '#0F0F13';
  const sub = theme === 'adult' ? '#ff9999' : dark ? '#9ca3af' : '#6b7280';
  const frameGlow = settings.frame === 'glow';

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette} />
      {theme === 'adult' && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(80% 60% at 50% 30%, rgba(255,45,45,0.16), transparent 70%)', animation: 'glowPulse 4s ease-in-out infinite' }} />}

      <div ref={scrollRef} onScroll={(e) => setScrollY(e.target.scrollTop)} className="relative z-10 w-full h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)' }}>
        {/* cover */}
        <div className="relative" style={{ height: 440 }}>
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '0 0 2rem 2rem', transform: `translateY(${scrollY * 0.3}px) scale(${1 + scrollY * 0.0004})`, transformOrigin: 'top' }}>
            <Photo data={photos[photoIdx]} rounded="0 0 2rem 2rem" className="w-full h-full" emojiSize={172} />
            <Grain opacity={0.08} blend="overlay" />
          </div>
          {frameGlow && <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: 440, borderRadius: '0 0 2rem 2rem', boxShadow: `inset 0 0 80px ${hexA(accent, 0.45)}, inset 0 -2px 0 ${hexA(accent, 0.5)}` }} />}
          <div className="absolute top-3 left-3 right-3 flex gap-1.5" style={{ paddingTop: 'calc(env(safe-area-inset-top))' }}>
            {photos.map((_, i) => <div key={i} className="flex-1 rounded-full" style={{ height: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: i === photoIdx ? '0 0 8px #fff' : 'none' }} />)}
          </div>
          <div className="absolute left-0 top-20 bottom-24 w-1/2" onClick={() => setPhotoIdx((p) => Math.max(0, p - 1))} />
          <div className="absolute right-0 top-20 bottom-24 w-1/2" onClick={() => setPhotoIdx((p) => Math.min(photos.length - 1, p + 1))} />
          <button onClick={() => pushToast('✏️ Редактирование (демо)')} className="absolute top-14 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <i className="ph-fill ph-pencil-simple text-white text-[18px]" />
          </button>
          {/* floating name panel */}
          <div className="absolute inset-x-3 bottom-3 rounded-[1.5rem] px-4 py-3.5 overflow-hidden" style={{ background: 'rgba(16,12,22,0.36)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[28px] font-black text-white leading-none tracking-tight">{user.name || 'Ты'}, {user.age}</h1>
              {verified && <VerifiedTick size={22} />}
              <span className="ml-auto"><PlanTag plan={plan} /></span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[12.5px] font-semibold flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.8)' }}><i className="ph-fill ph-map-pin" style={{ color: accent }} /> {user.city ? user.city.name : 'Москва'}</p>
              {settings.anthem && (
                <div className="flex items-center gap-2">
                  <Equalizer color="#fff" bars={4} height={14} />
                  <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>Мой гимн</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="screen-pad pt-4 space-y-3">
          {/* score ring + customization vibe */}
          <Glass dark={dark} className="p-4">
            <div className="flex items-center gap-4">
              <ScoreRing value={score} size={88} color={accent} track={dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'} />
              <div className="flex-1">
                <div className="text-[15px] font-black" style={{ color: txt }}>Привлекательность анкеты</div>
                <p className="mt-1 text-[12px] font-medium" style={{ color: sub }}>Добавь видео и пройди верификацию для 100%</p>
              </div>
            </div>
          </Glass>

          {/* CUSTOMIZATION */}
          <Glass dark={dark} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <i className="ph-fill ph-palette" style={{ color: accent }} />
              <span className="text-[14px] font-black" style={{ color: txt }}>Оформление профиля</span>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: sub }}>Вайб</div>
            <div className="flex gap-2.5 mb-4">
              {VIBE_LIST.map((v) => (
                <button key={v.id} onClick={() => setSettings({ vibe: v.id })} className="relative rounded-full transition active:scale-90 shrink-0" style={{ width: 38, height: 38 }}>
                  <span className="block w-full h-full rounded-full" style={{ background: `linear-gradient(135deg, ${v.blobs[0][0]}, ${v.blobs[1][0]})`, boxShadow: settings.vibe === v.id ? `0 0 0 2px ${dark ? '#141416' : '#fff'}, 0 0 0 4px ${v.accent}` : 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
                  {settings.vibe === v.id && <i className="ph-bold ph-check absolute inset-0 flex items-center justify-center text-white text-[15px]" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2"><i className="ph-fill ph-sparkle text-[16px]" style={{ color: accent }} /><span className="text-[13.5px] font-semibold" style={{ color: txt }}>Свечение рамки фото</span></div>
              <Toggle on={settings.frame === 'glow'} color={accent} onChange={(v) => setSettings({ frame: v ? 'glow' : 'flat' })} />
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2"><i className="ph-fill ph-music-notes text-[16px]" style={{ color: accent }} /><span className="text-[13.5px] font-semibold" style={{ color: txt }}>Музыкальный гимн</span></div>
              <Toggle on={settings.anthem} color={accent} onChange={(v) => setSettings({ anthem: v })} />
            </div>
          </Glass>

          {/* streak */}
          <Glass dark={dark} className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[24px]" style={{ background: hexA('#FF7849', 0.16) }}>🔥</div>
            <div className="flex-1">
              <div className="text-[16px] font-black" style={{ color: txt }}>7 дней подряд</div>
              <div className="text-[12px] font-medium" style={{ color: sub }}>Заходи каждый день за наградами</div>
            </div>
            <div className="flex gap-1">{[1, 1, 1, 1, 1, 1, 1].map((_, i) => <span key={i} className="w-1.5 rounded-full" style={{ height: 18, background: accent, opacity: 0.35 + i * 0.09 }} />)}</div>
          </Glass>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            {[[48, 'свайпов', false], [plan.superlikes || 5, 'суперлайков', false], [12, 'смотрели', true]].map(([n, l, clk], i) => (
              <Glass key={i} dark={dark} className={'p-3 text-center ' + (clk ? 'active:scale-95 transition cursor-pointer' : '')}>
                <div onClick={clk ? openViewers : undefined}>
                  <AnimNum value={n} className="text-[22px] font-black block" style={{ color: accent }} />
                  <div className="text-[11px] font-semibold mt-0.5" style={{ color: sub }}>{l}</div>
                </div>
              </Glass>
            ))}
          </div>

          {/* verification CTA */}
          {!verified && (
            <div className="rounded-3xl p-4 flex items-center gap-3 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.16), rgba(99,102,241,0.16))', border: '1px solid rgba(59,130,246,0.35)' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-[22px] shrink-0" style={{ background: 'rgba(59,130,246,0.2)' }}>🔵</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold" style={{ color: txt }}>Получи синюю галочку</div>
                <div className="text-[12px] font-medium" style={{ color: sub }}>+15 к анкете, фильтр Verified</div>
              </div>
              <Button variant="blue" size="sm" onClick={onVerify}>Верифицировать</Button>
            </div>
          )}

          {/* interests */}
          <div>
            <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: txt }}>Интересы</h3>
            <div className="flex flex-wrap gap-2">{user.tags.map((t) => <Pill key={t} interest={t} selected small />)}</div>
          </div>

          {/* about */}
          {user.bio && (
            <div>
              <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: txt }}>О себе</h3>
              <Glass dark={dark} className="p-4"><p className="text-[14px] font-medium leading-relaxed" style={{ color: dark ? '#ddd' : '#374151' }}>{user.bio}</p></Glass>
            </div>
          )}

          {/* settings toggles */}
          <Glass dark={dark} className="p-1 divide-y" style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-3 p-3.5">
              <span className="text-[22px]">🔞</span>
              <div className="flex-1"><div className="text-[15px] font-bold" style={{ color: txt }}>Комната 18+</div><div className="text-[12px] font-medium" style={{ color: sub }}>Только для verified</div></div>
              <Toggle on={settings.adult} color="#FF3333" onChange={(v) => { if (v && !verified) { pushToast('🔵 Сначала пройди верификацию'); return; } setSettings({ adult: v }); }} />
            </div>
            {gender === 'f' && (
              <div className="flex items-center gap-3 p-3.5">
                <span className="text-[22px]">🛡️</span>
                <div className="flex-1"><div className="text-[15px] font-bold" style={{ color: txt }}>Анти-Олигарх щит</div><div className="text-[12px] font-medium" style={{ color: sub }}>Бесплатно ♀ · невидимость для VIP</div></div>
                <Toggle on={settings.shield} color="#10B981" onChange={(v) => setSettings({ shield: v })} />
              </div>
            )}
          </Glass>

          {/* oligarch panel */}
          {plan.oligarch && (
            <div className="rounded-3xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#1c1708,#0c0c0c)', border: '1px solid rgba(255,215,0,0.4)', boxShadow: '0 10px 34px -12px rgba(255,215,0,0.3)' }}>
              <div className="absolute -top-10 right-0 w-40 h-24 pointer-events-none overflow-hidden">
                <div style={{ width: 60, height: 200, background: 'linear-gradient(90deg,transparent,rgba(255,215,0,0.25),transparent)', animation: 'goldSweep 5s ease-in-out infinite' }} />
              </div>
              <div className="flex items-center gap-2 mb-3 relative"><span className="text-[20px]">👑</span><span className="text-[16px] font-black" style={{ color: '#FFD700' }}>Режим Олигарх</span></div>
              <div className="flex items-center gap-3 mb-3 relative">
                <span className="text-[20px]">🕵️</span>
                <div className="flex-1"><div className="text-[14px] font-bold text-white">Стелс-режим</div><div className="text-[11px]" style={{ color: '#9a8a5a' }}>Невидим в общей ленте</div></div>
                <Toggle on={settings.stealth} color="#FFD700" onChange={(v) => setSettings({ stealth: v })} />
              </div>
              <div className="rounded-2xl px-3 py-2.5 flex items-center justify-between relative" style={{ background: 'rgba(255,215,0,0.08)' }}>
                <span className="text-[12px] font-semibold" style={{ color: '#c9b870' }}>VIP-сигналов сегодня</span>
                <span className="text-[14px] font-black" style={{ color: '#FFD700' }}>6 / 20</span>
              </div>
            </div>
          )}

          {/* upgrade CTA */}
          {plan.id === 'free' && (
            <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)', boxShadow: '0 16px 40px -16px rgba(255,0,255,0.6)' }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <Grain opacity={0.1} blend="soft-light" />
              <div className="relative">
                <div className="text-[20px] font-black text-white">Стань Купидоном 💘</div>
                <div className="text-[13px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.92)' }}>500 свайпов, режим Олигарх, 15 врывов</div>
                <button onClick={openTariffs} className="mt-3 h-11 px-5 rounded-2xl bg-white font-bold text-[14px] text-[#FF00FF] active:scale-95 transition">Открыть тарифы</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <TabBar active={active} onTab={onTab} accent={accent} dark={dark} dots={dots} />
    </div>
  );
}

Object.assign(window, { Profile, Glass });
