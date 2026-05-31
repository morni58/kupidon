/* ============================================================
   CupidBot — UI Kit showcase
   ============================================================ */
const { useState: kUseState } = React;

function Section({ id, title, desc, children }) {
  return (
    <section className="mb-12">
      <div className="mb-5">
        <h2 className="text-[26px] font-black tracking-tight text-[#0F0F13]">{title}</h2>
        {desc && <p className="text-[14px] font-medium text-[#6b7280] mt-1">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = '' }) {
  return <div className={'bg-white rounded-3xl p-6 border border-[#e5e7eb] ' + className} style={{ boxShadow: '0 8px 24px -16px rgba(0,0,0,0.12)' }}>{children}</div>;
}

const SWATCHES = [
  ['Бренд-фуксия', '#FF00FF', 'Главный акцент, лайк'],
  ['Бренд-розовый', '#FF66CC', 'Вторичный акцент'],
  ['Тёмный', '#0F0F13', 'Текст, подложки'],
  ['Светлый фон', '#FAFAFC', 'Фон приложения'],
  ['Серый текст', '#6b7280', 'Вторичный текст'],
  ['Светло-серый', '#e5e7eb', 'Разделители, скелетоны'],
  ['Золото VIP', '#FFD700', 'Kupidon / Олигарх'],
  ['Изумруд', '#10B981', 'Успех, щит'],
  ['Синий Verified', '#3B82F6', 'Галочка, TG'],
  ['Красный', '#EF4444', 'Свайп «нет», ошибки'],
  ['18+ фон', '#0A0000', 'Комната 18+'],
  ['18+ акцент', '#FF3333', 'Акценты 18+'],
];
const GRADIENTS = [
  ['Градиент бренда', 'linear-gradient(135deg,#FF00FF,#FF66CC)'],
  ['Градиент VIP', 'linear-gradient(135deg,#FFE259,#FFA751)'],
  ['Градиент 18+', 'linear-gradient(135deg,#FF3333,#FF00FF)'],
  ['Градиент 18+ карточка', 'linear-gradient(135deg,#4A0000,#1A0000)'],
];

function Kit() {
  const [toggles, setToggles] = kUseState({ a: false, b: true, c: false });
  const [tags, setTags] = kUseState(['music']);
  const [sheet, setSheet] = kUseState(false);

  return (
    <div className="min-h-screen dotbg" style={{ background: '#FAFAFC' }}>
      <div className="max-w-[1100px] mx-auto px-6 py-12">
        {/* header */}
        <div className="mb-12 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[40px] font-black tracking-tight" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CupidBot</div>
            <p className="text-[16px] font-medium text-[#6b7280] mt-1">UI-кит · дизайн-система · шрифт Onest</p>
          </div>
          <a href="index.html" className="inline-flex items-center gap-2 h-12 px-5 rounded-2xl text-white font-bold text-[14px]" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
            <i className="ph-bold ph-device-mobile" /> Открыть прототип
          </a>
        </div>

        {/* COLORS */}
        <Section title="Цвета" desc="Роли строго закреплены за цветами">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {SWATCHES.map(([name, hex, role]) => (
              <div key={hex} className="bg-white rounded-2xl overflow-hidden border border-[#e5e7eb]">
                <div style={{ background: hex, height: 72, borderBottom: hex === '#FAFAFC' ? '1px solid #e5e7eb' : 'none' }} />
                <div className="p-3">
                  <div className="text-[13px] font-bold text-[#0F0F13]">{name}</div>
                  <div className="text-[11px] font-mono text-[#9ca3af] mt-0.5">{hex}</div>
                  <div className="text-[11px] font-medium text-[#6b7280] mt-1">{role}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {GRADIENTS.map(([name, g]) => (
              <div key={name} className="bg-white rounded-2xl overflow-hidden border border-[#e5e7eb]">
                <div style={{ background: g, height: 72 }} />
                <div className="p-3"><div className="text-[13px] font-bold text-[#0F0F13]">{name}</div></div>
              </div>
            ))}
          </div>
        </Section>

        {/* TYPOGRAPHY */}
        <Section title="Типографика" desc="Onest, веса 300–900">
          <Card>
            <div className="space-y-4 divide-y divide-[#f3f4f6]">
              {[
                ['H1 · 34px / 900', 'Как тебя зовут?', 'text-[34px] font-black tracking-tight'],
                ['H2 · 24px / 800', 'Заголовки секций', 'text-[24px] font-extrabold'],
                ['H3 · 18px / 700', 'Подзаголовки', 'text-[18px] font-bold'],
                ['Body · 16px / 500', 'Основной текст — тёплый и живой, без канцелярита.', 'text-[16px] font-medium'],
                ['Caption · 12px / 600', 'ПОДПИСИ · UPPERCASE', 'text-[12px] font-semibold uppercase tracking-wider text-[#6b7280]'],
              ].map(([label, sample, cls], i) => (
                <div key={i} className={'flex items-baseline gap-6 ' + (i ? 'pt-4' : '')}>
                  <span className="text-[11px] font-mono text-[#9ca3af] w-32 shrink-0">{label}</span>
                  <span className={cls + ' text-[#0F0F13]'}>{i === 0 ? 'Как тебя зовут?' : sample}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* BUTTONS */}
        <Section title="Кнопки" desc="Primary / Secondary / Ghost / Gold + состояния">
          <Card>
            <div className="flex flex-wrap gap-3 items-center">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="gold">Gold VIP</Button>
              <Button variant="blue">Verified</Button>
              <Button disabled>Disabled</Button>
              <Button size="sm">Small</Button>
            </div>
          </Card>
        </Section>

        {/* INPUTS */}
        <Section title="Поля ввода" desc="Инпут, textarea — фокус фуксией">
          <Card>
            <div className="grid sm:grid-cols-2 gap-4">
              <input placeholder="Имя" className="h-14 rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none px-5 text-[16px] font-semibold text-[#0F0F13] placeholder:text-[#9ca3af] transition" />
              <textarea rows={3} placeholder="Расскажи о себе…" className="rounded-2xl bg-white border-2 border-[#e5e7eb] focus:border-[#FF00FF] outline-none p-4 text-[15px] font-medium resize-none transition" />
            </div>
          </Card>
        </Section>

        {/* TOGGLES + PILLS + BADGES */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Тумблеры" desc="Капсула 48×26, цвет по контексту">
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">Фуксия (обычный)</span><Toggle on={toggles.b} color="#FF00FF" onChange={(v) => setToggles((t) => ({ ...t, b: v }))} /></div>
                <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">Изумруд (щит)</span><Toggle on={toggles.c} color="#10B981" onChange={(v) => setToggles((t) => ({ ...t, c: v }))} /></div>
                <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">Золото (олигарх)</span><Toggle on={toggles.a} color="#FFD700" onChange={(v) => setToggles((t) => ({ ...t, a: v }))} /></div>
              </div>
            </Card>
          </Section>

          <Section title="Бейджи" desc="Статусы и метки">
            <Card>
              <div className="flex flex-wrap gap-3 items-center">
                <Badge kind="verified" />
                <Badge kind="common"><i className="ph-fill ph-check-circle" /> 3 общих тега</Badge>
                <Badge kind="vip" />
                <span className="inline-flex items-center rounded-full font-bold" style={{ background: '#e5e7eb', color: '#6b7280', fontSize: 11.5, padding: '4px 9px' }}>Free</span>
                <span className="inline-flex items-center rounded-full font-bold" style={{ background: 'rgba(255,0,255,0.12)', color: '#FF00FF', fontSize: 11.5, padding: '4px 9px' }}>Premium 💎</span>
                <span className="inline-flex items-center rounded-full font-bold" style={{ background: 'rgba(255,215,0,0.18)', color: '#B8860B', fontSize: 11.5, padding: '4px 9px' }}>Kupidon 👑</span>
              </div>
            </Card>
          </Section>
        </div>

        {/* TAGS */}
        <Section title="Пилюли-теги" desc="Обводка цветом тега; выбранный — залит">
          <Card>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <Pill key={i.id} interest={i} selected={tags.includes(i.id)} onClick={() => setTags((t) => t.includes(i.id) ? t.filter((x) => x !== i.id) : [...t, i.id])} />
              ))}
            </div>
          </Card>
        </Section>

        {/* PHOTO + SKELETON */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Фото-плейсхолдеры" desc="Градиент + эмодзи (object-cover)">
            <Card>
              <div className="flex gap-3 items-end">
                <Photo data={photo(13, '💃')} className="w-28 h-36" emojiSize={56} />
                <Avatar data={photo(5, '🐱')} size={64} />
                <Avatar data={photo(7, '✈️')} size={48} ring />
              </div>
            </Card>
          </Section>

          <Section title="Скелетоны" desc="Вместо спиннеров — пульсация">
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton style={{ width: 56, height: 56, borderRadius: 9999 }} />
                <div className="flex-1 space-y-2">
                  <Skeleton style={{ height: 14, width: '60%' }} />
                  <Skeleton style={{ height: 12, width: '85%' }} />
                </div>
              </div>
            </Card>
          </Section>
        </div>

        {/* SHEET DEMO */}
        <Section title="Модалка (bottom-sheet)" desc="Появляется снизу, «ручка» сверху">
          <Card>
            <Button onClick={() => setSheet(true)}>Открыть модалку</Button>
          </Card>
        </Section>

        <div className="text-center text-[13px] text-[#9ca3af] pt-6">CupidBot · дизайн-система · {SWATCHES.length} цветов · Onest · Phosphor Icons</div>
      </div>

      {/* sheet host (relative wrapper) */}
      <div className="fixed inset-0 pointer-events-none" style={{ display: sheet ? 'block' : 'none' }}>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[420px] pointer-events-auto" style={{ position: 'relative', height: '100%' }}>
          <Sheet open={sheet} onClose={() => setSheet(false)}>
            <h3 className="text-[20px] font-black text-[#0F0F13]">Пример модалки</h3>
            <p className="text-[14px] text-[#6b7280] mt-1 mb-4">Bottom-sheet с затемнением и ручкой сверху.</p>
            <Button onClick={() => setSheet(false)} className="w-full">Понятно</Button>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('kit-root')).render(<Kit />);
