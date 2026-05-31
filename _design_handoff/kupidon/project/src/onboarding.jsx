/* ============================================================
   CupidBot — Onboarding (9 steps)
   ============================================================ */
const { useState: oUseState, useRef: oUseRef, useEffect: oUseEffect } = React;

function OnbShell({ step, total, children, onBack }) {
  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      <MeshBG palette={VIBES.neon} grainOpacity={0.05} />
      <div className="relative z-10 flex flex-col h-full">
      <div className="safe-top screen-pad">
        <div className="flex items-center gap-3 pt-2 pb-4">
          {onBack ? (
            <button onClick={onBack} className="shrink-0 w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-white/60 flex items-center justify-center active:scale-90 transition">
              <i className="ph-bold ph-arrow-left text-[#0F0F13] text-[18px]" />
            </button>
          ) : <div className="w-9 h-9" />}
          <div className="flex-1">
            <Progress value={(step / total) * 100} height={6} track="rgba(0,0,0,0.07)" />
          </div>
          <span className="shrink-0 text-[12px] font-bold text-[#9ca3af] tabular-nums w-9 text-right">{step}/{total}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col screen-pad pb-6">{children}</div>
      </div>
    </div>
  );
}

function StepHead({ title, sub }) {
  return (
    <div className="mb-6">
      <h1 className="text-[34px] leading-[1.05] font-black tracking-tight text-[#0F0F13]">{title}</h1>
      {sub && <p className="mt-2 text-[15px] font-medium text-[#6b7280]">{sub}</p>}
    </div>
  );
}

// ---- Age dial: vertical wheel of numbers, swipe or drag ----
function AgeDial({ value, onChange }) {
  const min = 18, max = 60;
  const ref = oUseRef(null);
  const drag = oUseRef(null);

  const set = (v) => onChange(Math.max(min, Math.min(max, v)));

  oUseEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e) => { e.preventDefault(); set(value + (e.deltaY > 0 ? 1 : -1)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [value]);

  const onDown = (e) => { drag.current = { y: (e.touches ? e.touches[0].clientY : e.clientY), v: value }; };
  const onMove = (e) => {
    if (!drag.current) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = drag.current.y - y;
    set(drag.current.v + Math.round(dy / 26));
  };
  const onUp = () => { drag.current = null; };

  const nums = [value - 2, value - 1, value, value + 1, value + 2];
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div
        ref={ref}
        className="relative w-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        style={{ height: 280 }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        {/* center highlight band */}
        <div className="absolute left-6 right-6 rounded-2xl" style={{ height: 92, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,0,255,0.06)', border: '1.5px solid rgba(255,0,255,0.2)' }} />
        {nums.map((n, i) => {
          const d = Math.abs(i - 2);
          if (n < min || n > max) return <div key={i} style={{ height: d === 0 ? 92 : 48 }} />;
          const center = d === 0;
          return (
            <div key={i} className="flex items-center justify-center transition-all" style={{ height: center ? 92 : 48 }}>
              <span style={{
                fontSize: center ? 72 : d === 1 ? 34 : 24,
                fontWeight: 900, lineHeight: 1,
                opacity: center ? 1 : d === 1 ? 0.45 : 0.2,
                background: center ? 'linear-gradient(135deg,#FF00FF,#FF66CC)' : 'none',
                WebkitBackgroundClip: center ? 'text' : 'initial',
                WebkitTextFillColor: center ? 'transparent' : 'initial',
                color: center ? 'transparent' : '#0F0F13',
              }}>{n}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] font-medium text-[#9ca3af]">Тебе должно быть 18 лет или больше</p>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(+e.target.value)}
        className="w-full mt-5 accent-[#FF00FF]" style={{ accentColor: '#FF00FF' }} />
    </div>
  );
}

// ---- Photo slot grid ----
function PhotoGrid({ photos, setPhotos, pushToast }) {
  const [loadingIdx, setLoadingIdx] = oUseState(null);
  const add = (idx) => {
    if (loadingIdx !== null) return;
    setLoadingIdx(idx);
    setTimeout(() => {
      const g = GRADS[(idx * 5 + 2) % GRADS.length];
      const em = ['🤳', '😎', '🌟', '🏔️', '🎸'][idx] || '✨';
      const next = [...photos];
      next[idx] = { from: g[0], to: g[1], emoji: em };
      setPhotos(next);
      setLoadingIdx(null);
      pushToast('✅ Фото загружено');
    }, 900);
  };
  const remove = (idx, e) => { e.stopPropagation(); const next = [...photos]; next[idx] = null; setPhotos(next); };

  const Slot = ({ idx, big }) => {
    const p = photos[idx];
    const loading = loadingIdx === idx;
    return (
      <div
        onClick={() => !p && add(idx)}
        className="relative overflow-hidden cursor-pointer transition active:scale-[0.98]"
        style={{ aspectRatio: big ? '3/4' : '3/4', borderRadius: 20, gridRow: big ? 'span 2' : 'auto',
          border: p ? 'none' : '2px dashed #d1d5db', background: p ? 'transparent' : '#fff' }}
      >
        {p ? (
          <>
            <Photo data={p} rounded="20px" className="w-full h-full" emojiSize={big ? 80 : 44} />
            <button onClick={(e) => remove(idx, e)} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
              <i className="ph-bold ph-x text-white text-[14px]" />
            </button>
            {big && <span className="absolute bottom-2 left-2"><Badge kind="glass">★ Главное</Badge></span>}
          </>
        ) : loading ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#f3f4f6' }}>
            <i className="ph-bold ph-spinner text-[#FF00FF] text-[26px] animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <i className="ph-bold ph-plus text-[#d1d5db]" style={{ fontSize: big ? 38 : 26 }} />
            {big && <span className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Главное</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      <Slot idx={0} big />
      <Slot idx={1} />
      <Slot idx={2} />
      <Slot idx={3} />
      <Slot idx={4} />
    </div>
  );
}

function Onboarding({ onDone, pushToast }) {
  const [step, setStep] = oUseState(1);
  const [dir, setDir] = oUseState('R');
  const TOTAL = 9;
  const [name, setName] = oUseState('');
  const [age, setAge] = oUseState(24);
  const [gender, setGender] = oUseState(null);
  const [looking, setLooking] = oUseState(null);
  const [city, setCity] = oUseState(null);
  const [citySearch, setCitySearch] = oUseState('');
  const [photos, setPhotos] = oUseState([null, null, null, null, null]);
  const [tags, setTags] = oUseState([]);
  const [bio, setBio] = oUseState('');

  const go = (n) => { setDir(n > step ? 'R' : 'L'); setStep(n); };
  const next = () => go(step + 1);
  const back = () => (step > 1 ? go(step - 1) : null);

  const toggleTag = (id) => {
    setTags((t) => t.includes(id) ? t.filter((x) => x !== id) : t.length >= 5 ? t : [...t, id]);
  };

  const photoCount = photos.filter(Boolean).length;
  const cityList = CITIES.filter((c) => c.name.toLowerCase().includes(citySearch.toLowerCase()));

  const content = () => {
    switch (step) {
      case 1: return (
        <>
          <StepHead title="Как тебя зовут?" sub="Только имя — без фамилии 😊" />
          <div className="flex-1 flex flex-col justify-center">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя"
              className="w-full h-14 rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none px-5 text-[18px] font-semibold text-[#0F0F13] placeholder:text-[#9ca3af] transition" />
          </div>
          <Button disabled={name.trim().length < 2} onClick={next}>Далее <i className="ph-bold ph-arrow-right" /></Button>
        </>
      );
      case 2: return (
        <>
          <StepHead title="Сколько тебе лет?" />
          <AgeDial value={age} onChange={setAge} />
          <Button onClick={next}>Далее <i className="ph-bold ph-arrow-right" /></Button>
        </>
      );
      case 3: return (
        <>
          <StepHead title="Кто ты?" />
          <div className="flex-1 flex items-center">
            <div className="grid grid-cols-2 gap-3 w-full">
              {[{ id: 'm', label: 'Парень', emoji: '👨' }, { id: 'f', label: 'Девушка', emoji: '👩' }].map((g) => (
                <button key={g.id} onClick={() => { setGender(g.id); setTimeout(next, 180); }}
                  className="rounded-3xl flex flex-col items-center justify-center gap-2 transition active:scale-95"
                  style={{ height: 150, background: gender === g.id ? 'rgba(255,0,255,0.06)' : '#fff', border: `2px solid ${gender === g.id ? '#FF00FF' : '#e5e7eb'}` }}>
                  <span className="text-[52px]">{g.emoji}</span>
                  <span className="text-[17px] font-bold text-[#0F0F13]">{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      );
      case 4: return (
        <>
          <StepHead title="Кого ищешь?" />
          <div className="flex-1 flex flex-col justify-center gap-3">
            {[{ id: 'm', label: 'Парня', emoji: '👨' }, { id: 'f', label: 'Девушку', emoji: '👩' }, { id: 'all', label: 'Всех', emoji: '💞' }].map((o) => (
              <button key={o.id} onClick={() => { setLooking(o.id); setTimeout(next, 180); }}
                className="w-full rounded-2xl flex items-center gap-4 px-5 transition active:scale-[0.98]"
                style={{ height: 72, background: looking === o.id ? 'rgba(255,0,255,0.06)' : '#fff', border: `2px solid ${looking === o.id ? '#FF00FF' : '#e5e7eb'}` }}>
                <span className="text-[30px]">{o.emoji}</span>
                <span className="text-[18px] font-bold text-[#0F0F13]">{o.label}</span>
                <i className="ph-bold ph-arrow-right ml-auto text-[#d1d5db]" />
              </button>
            ))}
          </div>
        </>
      );
      case 5: return (
        <>
          <StepHead title="Где ты?" sub="Чтобы показывать людей рядом" />
          <div className="flex-1 flex flex-col">
            <Button onClick={() => { setCity(CITIES[0]); setCitySearch(''); }}><i className="ph-fill ph-map-pin" /> Найти меня</Button>
            <div className="relative mt-4">
              <i className="ph-bold ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input value={citySearch} onChange={(e) => { setCitySearch(e.target.value); setCity(null); }} placeholder="или введи город…"
                className="w-full h-12 rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none pl-11 pr-4 text-[15px] font-semibold text-[#0F0F13] placeholder:text-[#9ca3af] transition" />
            </div>
            {citySearch && !city && (
              <div className="mt-2 bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden noscroll" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {cityList.map((c) => (
                  <button key={c.name} onClick={() => { setCity(c); setCitySearch(''); }} className="w-full px-4 py-3 flex flex-col items-start active:bg-[#FAFAFC] border-b border-[#f3f4f6] last:border-0">
                    <span className="text-[15px] font-bold text-[#0F0F13]">{c.name}</span>
                    <span className="text-[12px] text-[#9ca3af]">{c.region}</span>
                  </button>
                ))}
                {cityList.length === 0 && <div className="px-4 py-3 text-[14px] text-[#9ca3af]">Ничего не найдено</div>}
              </div>
            )}
            {city && (
              <div className="mt-3 flex items-center gap-2 text-[15px] font-bold text-[#10B981]">
                <i className="ph-fill ph-check-circle text-[20px]" /> {city.name}
              </div>
            )}
          </div>
          <Button onClick={next} variant={city ? 'primary' : 'secondary'}>{city ? <>Далее <i className="ph-bold ph-arrow-right" /></> : 'Пропустить'}</Button>
        </>
      );
      case 6: return (
        <>
          <StepHead title="Добавь фото" sub="Первое фото обязательно. До 5 штук" />
          <div className="flex-1">
            <PhotoGrid photos={photos} setPhotos={setPhotos} pushToast={pushToast} />
          </div>
          <Button disabled={photoCount < 1} onClick={next}>{photoCount < 1 ? 'Добавь хотя бы 1 фото' : <>Далее <i className="ph-bold ph-arrow-right" /></>}</Button>
        </>
      );
      case 7: return (
        <>
          <StepHead title="Твои интересы" sub="Выбери до 5" />
          <div className="mb-4 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-black/8 overflow-hidden"><div className="h-full rounded-full transition-all duration-300" style={{ width: (tags.length / 5 * 100) + '%', background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }} /></div>
            <span className="text-[13px] font-black text-[#0F0F13] tabular-nums">{tags.length}/5</span>
          </div>
          <div className="flex-1 flex flex-wrap gap-2.5 content-start">
            {INTERESTS.map((i) => (
              <Pill key={i.id} interest={i} selected={tags.includes(i.id)} dim={!tags.includes(i.id) && tags.length >= 5}
                onClick={() => toggleTag(i.id)} />
            ))}
          </div>
          <Button disabled={tags.length === 0} onClick={next}>Далее <i className="ph-bold ph-arrow-right" /></Button>
        </>
      );
      case 8: return (
        <>
          <StepHead title="Расскажи о себе" sub="Необязательно, но +10% к привлекательности 🔥" />
          <div className="flex-1">
            <div className="relative">
              <textarea value={bio} maxLength={150} onChange={(e) => setBio(e.target.value)} rows={4}
                placeholder="Обожаю горы, кофе по утрам и плохие шутки…"
                className="w-full rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none p-4 text-[15px] font-medium text-[#0F0F13] placeholder:text-[#9ca3af] resize-none transition" />
              <span className="absolute bottom-3 right-4 text-[12px] font-bold text-[#9ca3af]">{bio.length}/150</span>
            </div>
          </div>
          <Button onClick={next}>🚀 В ленту!</Button>
        </>
      );
      case 9: return (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Confetti />
          <div className="relative flex items-center justify-center mb-2" style={{ width: 160, height: 160 }}>
            <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,0,255,0.35), transparent 70%)', animation: 'glowPulse 2.5s ease-in-out infinite' }} />
            <div className="text-[88px] floaty">🎉</div>
          </div>
          <h1 className="text-[38px] font-black tracking-tight text-[#0F0F13]" style={{ textShadow: '0 0 30px rgba(255,0,255,0.3)' }}>Готово!</h1>
          <p className="mt-2 text-[16px] font-medium text-[#6b7280] px-6">Твоя анкета готова. Время знакомиться!</p>
          <div className="w-full mt-10">
            <Button onClick={() => onDone({ name, age, gender, looking, city, photos, tags, bio })}>Начать свайпать 💕</Button>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <OnbShell step={step} total={TOTAL} onBack={step > 1 && step !== 9 ? back : null}>
      <div key={step} className={dir === 'R' ? 'anim-slideR flex-1 flex flex-col min-h-0' : 'anim-slideL flex-1 flex flex-col min-h-0'}>
        {content()}
      </div>
    </OnbShell>
  );
}

window.Onboarding = Onboarding;
