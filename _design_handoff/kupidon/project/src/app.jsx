/* ============================================================
   CupidBot — App (shared store, router, demo dock)
   The dock lives on its OWN React root (outside the scaled phone),
   so we share state through a tiny external store both roots read.
   ============================================================ */
const { useState: aUseState, useEffect: aUseEffect, useRef: aUseRef, useSyncExternalStore } = React;

const DEMO_USER = {
  name: 'Алекс', age: 26, gender: 'm', looking: 'f',
  city: { name: 'Москва', region: 'Москва и область' },
  photos: [photo(2, '😎'), photo(9, '🏔️'), photo(6, '🎸'), null, null],
  tags: ['music', 'travel', 'sport'],
  bio: 'Музыка, горы и хороший кофе. Ищу с кем делить плейлисты и приключения.',
};

// ---------- external store ----------
const store = {
  state: {
    screen: 'onboarding', planId: 'free', user: DEMO_USER,
    settings: { verified: true, adult: false, shield: false, stealth: false, vibe: 'neon', frame: 'glow', anthem: true },
    swipesLeft: PLANS.free.swipes, toast: null, activeChat: 'c_alisa',
  },
  listeners: new Set(),
  get() { return this.state; },
  set(patch) {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  },
  subscribe(l) { this.listeners.add(l); return () => this.listeners.delete(l); },
};
function useStore() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.state
  );
}
const deriveTheme = (s) => s.settings.adult ? 'adult' : (s.planId === 'kupidon' && s.settings.stealth) ? 'oligarch' : 'light';

// ---------- actions ----------
let toastTimer = null;
const actions = {
  setScreen: (screen) => store.set({ screen }),
  pushToast: (toast) => { store.set({ toast }); clearTimeout(toastTimer); toastTimer = setTimeout(() => store.set({ toast: null }), 2200); },
  setSettings: (patch) => store.set((s) => ({ settings: typeof patch === 'function' ? patch(s.settings) : { ...s.settings, ...patch } })),
  setUser: (patch) => store.set((s) => ({ user: typeof patch === 'function' ? patch(s.user) : { ...s.user, ...patch } })),
  setSwipesLeft: (patch) => store.set((s) => ({ swipesLeft: typeof patch === 'function' ? patch(s.swipesLeft) : patch })),
  setActiveChat: (activeChat) => store.set({ activeChat }),
  changePlan: (id) => store.set((s) => ({
    planId: id, swipesLeft: PLANS[id].swipes,
    settings: id !== 'kupidon' ? { ...s.settings, stealth: false } : s.settings,
  })),
  setThemeManual: (t) => store.set((s) => {
    if (t === 'adult') return { settings: { ...s.settings, adult: true, stealth: false } };
    if (t === 'oligarch') return { planId: 'kupidon', swipesLeft: PLANS.kupidon.swipes, settings: { ...s.settings, adult: false, stealth: true } };
    return { settings: { ...s.settings, adult: false, stealth: false } };
  }),
  openChat: (id) => store.set({ activeChat: id, screen: 'dialog' }),
  finishOnboarding: (data) => store.set({
    screen: 'feed',
    user: {
      ...DEMO_USER, name: data.name || 'Алекс', age: data.age, gender: data.gender || 'm',
      looking: data.looking, city: data.city || DEMO_USER.city,
      photos: data.photos.some(Boolean) ? data.photos : DEMO_USER.photos,
      tags: data.tags.length ? data.tags : DEMO_USER.tags, bio: data.bio || '',
    },
    settings: { verified: false, adult: false, shield: false, stealth: false, vibe: 'neon', frame: 'glow', anthem: true },
  }),
  verifySuccess: () => { actions.setSettings({ verified: true }); actions.pushToast('✓ Синяя галочка добавлена'); store.set({ screen: 'profile' }); },
};

// ---------- main app ----------
function App() {
  const s = useStore();
  const plan = PLANS[s.planId];
  const theme = deriveTheme(s);
  const gender = s.user.gender;
  const dots = { likes: true, chats: CHATS.some((c) => c.unread > 0) };
  const onTab = actions.setScreen;

  let view;
  switch (s.screen) {
    case 'onboarding':
      view = <Onboarding onDone={actions.finishOnboarding} pushToast={actions.pushToast} />; break;
    case 'feed':
      view = <Feed theme={theme} plan={plan} swipesLeft={s.swipesLeft} setSwipesLeft={actions.setSwipesLeft}
        onMatch={() => actions.openChat('c_alisa')} onUpgrade={actions.changePlan} pushToast={actions.pushToast}
        dots={dots} active="feed" onTab={onTab} openTariffs={() => actions.setScreen('pricing')} />; break;
    case 'likes':
      view = <Likes plan={plan} gender={gender} settings={s.settings} onOpenChat={actions.openChat}
        onUpgrade={actions.changePlan} pushToast={actions.pushToast} dots={dots} active="likes" onTab={onTab}
        openTariffs={() => actions.setScreen('pricing')} />; break;
    case 'chats':
      view = <Chats onOpenChat={actions.openChat} active="chats" onTab={onTab} dots={dots} />; break;
    case 'profile':
      view = <Profile user={s.user} theme={theme} plan={plan} gender={gender} settings={s.settings} setSettings={actions.setSettings}
        onVerify={() => actions.setScreen('verify')} onUpgrade={actions.changePlan} openViewers={() => actions.setScreen('likes')}
        openTariffs={() => actions.setScreen('pricing')} active="profile" onTab={onTab} dots={dots} pushToast={actions.pushToast} />; break;
    case 'dialog':
      view = <Dialog chatId={s.activeChat} plan={plan} onBack={() => actions.setScreen('chats')} pushToast={actions.pushToast} />; break;
    case 'verify':
      view = <Verification onBack={() => actions.setScreen('profile')} pushToast={actions.pushToast} onSuccess={actions.verifySuccess} />; break;
    case 'pricing':
      view = <Pricing onBack={() => actions.setScreen('profile')} currentPlan={s.planId} onSelectPlan={actions.changePlan} pushToast={actions.pushToast} />; break;
    default: view = null;
  }

  return (
    <>
      <div key={s.screen} className="w-full h-full">{view}</div>
      <Toast toast={s.toast} />
    </>
  );
}

/* ---------- Demo control dock (own React root, outside the phone) ---------- */
function Seg({ options, value, onChange }) {
  return (
    <div className="flex bg-black/30 rounded-xl p-0.5 gap-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap"
          style={{ background: value === o.v ? o.color || '#FF00FF' : 'transparent', color: value === o.v ? (o.dark ? '#0F0F13' : '#fff') : 'rgba(255,255,255,0.6)' }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function DemoDock() {
  const s = useStore();
  const theme = deriveTheme(s);
  const [open, setOpen] = aUseState(true);
  const jumps = [
    { id: 'onboarding', l: 'Онбординг', i: 'ph-sparkle' },
    { id: 'feed', l: 'Лента', i: 'ph-cards' },
    { id: 'likes', l: 'Симпатии', i: 'ph-heart' },
    { id: 'chats', l: 'Чаты', i: 'ph-chat-circle' },
    { id: 'profile', l: 'Профиль', i: 'ph-user' },
    { id: 'verify', l: 'Верификация', i: 'ph-seal-check' },
    { id: 'pricing', l: 'Тарифы', i: 'ph-crown' },
  ];
  return (
    <div className="fixed z-[100] right-4 top-1/2 -translate-y-1/2" style={{ fontFamily: 'Onest' }}>
      {open ? (
        <div className="w-[210px] rounded-2xl p-3 space-y-3" style={{ background: 'rgba(20,20,24,0.94)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-black text-white tracking-[0.15em]">DEMO · CUPIDBOT</span>
            <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <i className="ph-bold ph-caret-right text-white text-[12px]" />
            </button>
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Экран</div>
            <div className="grid grid-cols-2 gap-1">
              {jumps.map((j) => (
                <button key={j.id} onClick={() => actions.setScreen(j.id)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10.5px] font-semibold transition"
                  style={{ background: s.screen === j.id ? '#FF00FF' : 'rgba(255,255,255,0.06)', color: s.screen === j.id ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                  <i className={'ph-fill ' + j.i + ' text-[12px]'} />{j.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Подписка</div>
            <Seg value={s.planId} onChange={actions.changePlan} options={[
              { v: 'free', l: 'Free', color: '#6b7280' },
              { v: 'premium', l: 'Premium', color: '#FF00FF' },
              { v: 'kupidon', l: 'Kupidon', color: '#FFD700', dark: true },
            ]} />
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Тема</div>
            <Seg value={theme} onChange={actions.setThemeManual} options={[
              { v: 'light', l: 'Light', color: '#FF00FF' },
              { v: 'adult', l: '18+', color: '#FF3333' },
              { v: 'oligarch', l: 'Олигарх', color: '#FFD700', dark: true },
            ]} />
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Пол профиля</div>
            <Seg value={s.user.gender} onChange={(g) => actions.setUser({ gender: g })} options={[
              { v: 'm', l: 'Парень', color: '#3B82F6' },
              { v: 'f', l: 'Девушка', color: '#FF66CC' },
            ]} />
          </div>

          <a href="UI Kit.html" className="flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold text-white transition" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <i className="ph-bold ph-swatches" /> UI-кит
          </a>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(20,20,24,0.94)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <i className="ph-bold ph-sliders-horizontal text-white text-[18px]" />
        </button>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
ReactDOM.createRoot(document.getElementById('dock-root')).render(<DemoDock />);
