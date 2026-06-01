import { useState, useRef, useEffect } from 'react'
import { MeshBG, VIBES } from '../design/fx'
import { Photo, Button, TabBar, VerifiedTick } from '../design/ui'
import { gradPhoto } from '../design/data'
import { SkeletonRows } from '../design/loaders'
import { api, createChatWS, haptic, mediaUrl, openInvoice } from '../lib/api'

const pic = (urlOrNull, seedName = '?', emoji = '🙂') => urlOrNull ? { url: mediaUrl(urlOrNull) } : gradPhoto(seedName.charCodeAt(0), emoji)

function ScreenHead({ title, sub, dark }) {
  return (
    <div className="safe-top screen-pad shrink-0 pb-2">
      <h1 className="text-[26px] font-black tracking-tight pt-1" style={{ color: dark ? '#fff' : '#0F0F13' }}>{title}</h1>
      {sub && <p className="text-[13px] font-medium mt-0.5" style={{ color: dark ? '#aaa' : '#6b7280' }}>{sub}</p>}
    </div>
  )
}

// Surface helpers so cards respond to the active theme everywhere (U-CUSTOM).
const surfaceStyle = (dark) => dark
  ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }
  : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 24px -14px rgba(0,0,0,0.12)' }

/* ---------------- LIKES ---------------- */
export function Likes({ plan, me, palette, accent = '#FF00FF', dark = false, onOpenChat, setToast, dots, active, onTab }) {
  const [items, setItems] = useState([])
  const [views, setViews] = useState({ count: 0, items: [], is_premium: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.sympathies().catch(() => []), api.whoViewedMe().catch(() => ({ count: 0, items: [], is_premium: false }))])
      .then(([s, v]) => { setItems(s); setViews(v); setLoading(false) })
  }, [])

  async function write(item) {
    if (plan.id === 'free') {
      // Free: pay 50⭐ for a one-shot Force Chat, then open it (UX3).
      try {
        const inv = await api.createInvoice('force_chat')
        if (!inv.invoice_link) { setToast('Платёж недоступен, попробуй позже'); return }
        const st = await openInvoice(inv.invoice_link)
        if (st !== 'paid') return
        // The bot grants the paid ticket asynchronously — retry briefly (race fix).
        setToast('Открываю чат…')
        let r = null
        for (let i = 0; i < 5 && !r; i++) {
          try { r = await api.forceChat(item.user_id) }
          catch (err) { if (err.status === 402) await new Promise((res) => setTimeout(res, 900)); else throw err }
        }
        if (!r) { setToast('Оплата прошла, но чат не открылся. Попробуй из «Симпатий» ещё раз.'); return }
        haptic('medium'); onOpenChat(r.match_id)
      } catch (e) { setToast(e?.data?.detail || 'Не удалось') }
      return
    }
    try { const r = await api.forceChat(item.user_id); haptic('medium'); onOpenChat(r.match_id) }
    catch (e) { if (e.status === 429) setToast('Лимит врывов на сегодня'); else if (e.status === 402) setToast('Нужна оплата'); else setToast(e?.data?.detail || 'Ошибка') }
  }

  async function goldenKey(item) {
    try {
      const r = await api.goldenContact(item.user_id); haptic('success')
      if (r.link) { setToast('🗝️ Контакт выкуплен'); openInvoice && window.open?.(r.link, '_blank') }
      else { setToast('🗝️ Контакт открыт в чатах'); onOpenChat(r.match_id) }
    } catch (e) { setToast(e?.status === 402 ? 'Недостаточно Stars (нужно 1000)' : (e?.data?.detail || 'Ошибка')) }
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette || VIBES.neon} grainOpacity={0.05} />
      <div className="relative z-10 h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)' }}>
        <ScreenHead title="Симпатии ❤️" sub="Они лайкнули тебя" dark={dark} />
        <div className="screen-pad space-y-3 pt-2">
          {loading && <SkeletonRows count={5} dark={dark} />}
          {!loading && items.length === 0 && (
            <div className="text-center py-16">
              <div className="text-[56px]">💔</div>
              <h2 className="text-[18px] font-black mt-2" style={{ color: dark ? '#fff' : '#0F0F13' }}>Пока никто не лайкнул</h2>
              <p className="text-[13px] text-[#6b7280] mt-1">Свайпай активнее — и симпатии появятся!</p>
            </div>
          )}

          {items.map((l) => l.is_vip ? (
            <div key={l.user_id} className="rounded-3xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#1a1505,#0d0d0d)', border: '1.5px solid #FFD700', boxShadow: '0 12px 30px -10px rgba(255,215,0,0.35)' }}>
              <div className="flex items-center gap-3 relative">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-[30px]" style={{ background: 'linear-gradient(135deg,#3a3a3a,#1a1a1a)', filter: 'blur(1px)' }}>🕴️</div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[14px]" style={{ background: 'linear-gradient(135deg,#FFE259,#FFA751)' }}>👑</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-black" style={{ color: '#FFD700' }}>VIP проявил интерес</div>
                  {l.vip_info?.message && <div className="text-[12px] italic mt-0.5" style={{ color: '#c9b870' }}>«{l.vip_info.message}»</div>}
                  <div className="text-[11px] mt-0.5" style={{ color: '#8a7a4a' }}>Лайкни, чтобы узнать кто</div>
                </div>
                <Button variant="gold" size="sm" onClick={() => write(l)}>Раскрыть</Button>
              </div>
            </div>
          ) : (
            <div key={l.user_id} className="rounded-3xl p-3 flex items-center gap-3" style={surfaceStyle(dark)}>
              <Photo data={pic(l.photo, l.name, '💃')} rounded="16px" className="w-16 h-16 shrink-0" emojiSize={34} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[16px] font-bold" style={{ color: dark ? '#fff' : '#0F0F13' }}>{l.name}{l.age ? `, ${l.age}` : ''}</span>
                  {l.is_verified && <VerifiedTick size={16} />}
                </div>
                <div className="text-[12px] font-medium text-[#9ca3af] mt-0.5">Лайкнул(а) недавно</div>
              </div>
              {plan.id === 'kupidon' && (
                <button onClick={() => goldenKey(l)} title="Выкупить контакт (1000⭐)" className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition shrink-0" style={{ background: 'linear-gradient(135deg,#FFE259,#FFA751)' }}>
                  <span className="text-[16px]">🗝️</span>
                </button>
              )}
              <Button size="sm" onClick={() => write(l)}>Написать</Button>
            </div>
          ))}

          {/* who viewed you */}
          <div className="pt-2">
            <h3 className="text-[15px] font-bold mb-2 px-1" style={{ color: dark ? '#fff' : '#0F0F13' }}>👁 Кто смотрел тебя</h3>
            {views.is_premium ? (
              <div className="grid grid-cols-4 gap-3">
                {views.items.map((v, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Photo data={pic(null, v.name || '?', '🙂')} rounded="9999px" className="w-16 h-16" emojiSize={32} />
                    <span className="text-[11px] font-semibold text-[#6b7280] truncate w-full text-center">{v.name}</span>
                  </div>
                ))}
                {views.items.length === 0 && <span className="text-[13px] text-[#9ca3af] col-span-4">Пока никто не смотрел</span>}
              </div>
            ) : (
              <div className="rounded-3xl p-4" style={surfaceStyle(dark)}>
                <div className="flex gap-3 mb-3">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="w-14 h-14 rounded-full" style={{ background: 'linear-gradient(135deg,#d1d5db,#9ca3af)', filter: 'blur(3px)' }} />)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#6b7280]">{views.count} человек смотрели тебя</span>
                  <span className="text-[13px] font-bold text-[#FF00FF]">Открой с Premium</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <TabBar active={active} onTab={onTab} accent={accent} dark={dark} dots={dots} />
    </div>
  )
}

/* ---------------- CHATS LIST ---------------- */
export function Chats({ palette, accent = '#FF00FF', dark = false, onOpenChat, active, onTab, dots }) {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.chats().then((c) => { setChats(c); setLoading(false) }).catch(() => setLoading(false)) }, [])
  return (
    <div className="w-full h-full relative overflow-hidden">
      <MeshBG palette={palette || VIBES.neon} grainOpacity={0.05} />
      <div className="relative z-10 h-full overflow-y-auto noscroll" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)' }}>
        <ScreenHead title="Чаты 💬" sub="Твои совпадения" dark={dark} />
        {loading ? (
          <div className="screen-pad pt-2"><SkeletonRows count={6} dark={dark} /></div>
        ) : chats.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center px-8">
            <div className="text-[64px]">💬</div>
            <h2 className="text-[20px] font-black mt-2" style={{ color: dark ? '#fff' : '#0F0F13' }}>Нет чатов</h2>
            <p className="text-[14px] mt-1" style={{ color: dark ? '#9ca3af' : '#6b7280' }}>Свайпай — и они появятся!</p>
          </div>
        ) : (
          <div className="screen-pad pt-2">
            {chats.map((c) => (
              <button key={c.id} onClick={() => onOpenChat(c.id)} className="w-full flex items-center gap-3 py-3 active:bg-black/[0.02] rounded-2xl px-2 -mx-2 transition relative">
                {c.is_18_room && <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ background: '#FF3333' }} />}
                <div className="relative shrink-0">
                  <Photo data={pic(c.photo, c.name, '💞')} rounded="9999px" className="w-14 h-14" emojiSize={30} />
                  {c.online && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#10B981]" style={{ boxShadow: '0 0 0 2px #FAFAFC' }} />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-[16px] font-bold" style={{ color: dark ? '#fff' : '#0F0F13' }}>{c.name}</span>
                    {c.verified && <VerifiedTick size={15} />}
                  </div>
                  <div className="text-[13px] font-medium text-[#9ca3af] truncate mt-0.5">{c.last}</div>
                </div>
                {c.unread > 0 && (
                  <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black text-white" style={{ background: accent }}>{c.unread > 99 ? '99+' : c.unread}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <TabBar active={active} onTab={onTab} accent={accent} dark={dark} dots={dots} />
    </div>
  )
}

/* ---------------- DIALOG ---------------- */
export function Dialog({ chatId, me, plan, theme, accent: accentProp, onBack, setToast }) {
  const [info, setInfo] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [ices, setIces] = useState([])
  const [consentFrom, setConsentFrom] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [revealed, setRevealed] = useState({})
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const wsRef = useRef(null)
  const fileRef = useRef(null)
  const typingTimer = useRef(null)
  const lastTypingSent = useRef(0)

  const adult = info?.is_18_room
  const accent = adult ? '#FF3333' : (accentProp || '#FF00FF')

  useEffect(() => {
    if (!chatId) return
    api.chatInfo(chatId).then(setInfo).catch(() => {})
    api.messages(chatId).then(setMsgs).catch(() => {})
    api.icebreakers().then(setIces).catch(() => {})
    api.markRead(chatId).catch(() => {})
    const ws = createChatWS(chatId, (data) => {
      if (data.type === 'message_sent' && data.message?.sender_id !== me?.id) { setMsgs((m) => [...m, data.message]); setTyping(false) }
      else if (data.type === 'tg_consent_request' && data.from_id !== me?.id) setConsentFrom(data.from_id)
      else if (data.type === 'tg_consent_approved') { setToast('✈️ Контакты открыты'); api.chatInfo(chatId).then(setInfo) }
      else if (data.type === 'typing' && data.user_id !== me?.id) {
        setTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 2500)
      }
      else if (data.type === 'poll') setMsgs(data.messages)
    })
    wsRef.current = ws
    return () => ws.close()
  }, [chatId])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [msgs])

  const myCount = info?.my_messages || msgs.filter((m) => m.sender_id === me?.id).length
  const tgUnlocked = info?.tg_unlocked || plan.tgMsgs === 0 || myCount >= plan.tgMsgs
  const remainTg = Math.max(0, plan.tgMsgs - myCount)
  // Icebreakers show until there's a real (text/media) message — system/consent don't count.
  const noMsgsYet = !msgs.some((m) => m.msg_type === 'text' || m.msg_type === 'media' || (m.content && m.msg_type !== 'system' && m.msg_type !== 'consent'))

  async function send(t) {
    const v = (t || text).trim()
    if (!v) return
    setText('')
    try {
      const msg = await api.sendMessage(chatId, v)
      setMsgs((m) => [...m, msg]); haptic('light')
    } catch (e) { setToast(e?.data?.detail || 'Не отправлено') }
  }

  async function approveTg() { try { await api.approveTg(chatId); setConsentFrom(null); setToast('✈️ Контакты открыты'); api.chatInfo(chatId).then(setInfo) } catch {} }
  async function declineTg() { try { await api.declineTg(chatId) } catch {} setConsentFrom(null) }

  async function reportUser() {
    setMenuOpen(false)
    if (!info?.partner_id) return
    try { await api.report(info.partner_id); setToast('⚠️ Жалоба отправлена') } catch (e) { setToast(e?.data?.detail === 'Already reported' ? 'Уже отправлено' : 'Не удалось') }
  }
  async function blockUser() {
    setMenuOpen(false)
    if (!info?.partner_id) return
    try { await api.block(info.partner_id); setToast('🚫 Пользователь заблокирован'); onBack() } catch { setToast('Не удалось') }
  }

  async function sendMedia(file) {
    if (!file) return
    setSending(true)
    try { const msg = await api.sendChatMedia(chatId, file); setMsgs((m) => [...m, msg]); haptic('light') }
    catch (e) { setToast(e?.data?.detail === 'Media flagged as NSFW' ? 'Фото отклонено модерацией' : 'Не отправлено') }
    setSending(false)
  }

  async function revealMedia(m) {
    // 18+ disappearing media: show once, then burn for the recipient.
    setRevealed((r) => ({ ...r, [m.id]: true }))
    if (m.is_disappearing && m.sender_id !== me?.id) {
      try { await api.burnMedia(m.id) } catch {}
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative" style={{ background: adult ? '#0A0000' : '#FAFAFC' }}>
      <div className="safe-top shrink-0" style={{ background: adult ? 'rgba(20,0,0,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: adult ? '1px solid #4A0000' : '1px solid #f3f4f6' }}>
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-1">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition shrink-0"><i className="ph-bold ph-arrow-left text-[20px]" style={{ color: adult ? '#fff' : '#0F0F13' }} /></button>
          <Photo data={pic(info?.photo, info?.name || '?', '💞')} rounded="9999px" className="w-9 h-9 shrink-0" emojiSize={20} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold" style={{ color: adult ? '#fff' : '#0F0F13' }}>{info?.name || 'Чат'}</span>
              {info?.verified && <VerifiedTick size={14} />}
            </div>
            {typing ? <span className="text-[11px] font-semibold" style={{ color: accent }}>печатает…</span>
              : info?.online && <span className="text-[11px] font-semibold text-[#10B981]">в сети</span>}
          </div>
          <button onClick={() => setMenuOpen((v) => !v)} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"><i className="ph-bold ph-dots-three-vertical text-[20px]" style={{ color: adult ? '#fff' : '#9ca3af' }} /></button>
          <div className="flex flex-col items-center shrink-0">
            <button onClick={() => tgUnlocked ? setToast('✈️ Telegram открыт') : api.requestTg(chatId).then(() => setToast('Запрос отправлен')).catch(() => {})} className="w-9 h-9 rounded-full flex items-center justify-center transition" style={{ background: tgUnlocked ? 'linear-gradient(135deg,#3B82F6,#6366F1)' : '#e5e7eb' }}>
              <i className="ph-fill ph-telegram-logo text-[18px]" style={{ color: tgUnlocked ? '#fff' : '#9ca3af' }} />
            </button>
            {!tgUnlocked && <span className="text-[8px] font-bold text-[#9ca3af] mt-0.5 whitespace-nowrap">ещё {remainTg} смс</span>}
          </div>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className="absolute inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute z-40 right-3 rounded-2xl overflow-hidden shadow-xl" style={{ top: 'calc(env(safe-area-inset-top) + 48px)', background: '#fff', border: '1px solid #e5e7eb', minWidth: 180 }}>
            <button onClick={reportUser} className="w-full px-4 py-3 flex items-center gap-2.5 text-[14px] font-semibold text-[#0F0F13] active:bg-[#FAFAFC] border-b border-[#f3f4f6]"><i className="ph-bold ph-warning text-[#F59E0B]" /> Пожаловаться</button>
            <button onClick={blockUser} className="w-full px-4 py-3 flex items-center gap-2.5 text-[14px] font-semibold text-[#EF4444] active:bg-[#FAFAFC]"><i className="ph-bold ph-prohibit" /> Заблокировать</button>
          </div>
        </>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto noscroll px-4 py-4 space-y-2">
        {msgs.map((m) => {
          if (m.msg_type === 'consent' || m.msg_type === 'system') return null
          const mine = m.sender_id === me?.id
          // Media message
          if (m.msg_type === 'media' || m.media_url) {
            const burned = m.is_burned || (m.is_disappearing && revealed[m.id] && !mine)
            const showBlur = m.is_disappearing && !revealed[m.id] && !mine
            return (
              <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                <div className="max-w-[70%] rounded-2xl overflow-hidden relative" style={{ width: 200, height: 240, background: '#111' }}>
                  {burned ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-3" style={{ color: '#9ca3af' }}>
                      <i className="ph-fill ph-fire text-[28px]" /><span className="text-[12px] font-semibold">Фото сгорело</span>
                    </div>
                  ) : m.media_url ? (
                    <>
                      <img src={mediaUrl(m.media_url)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', filter: showBlur ? 'blur(22px)' : 'none' }} draggable={false} />
                      {showBlur && (
                        <button onClick={() => revealMedia(m)} className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white" style={{ background: 'rgba(0,0,0,0.35)' }}>
                          <i className="ph-fill ph-fire text-[30px]" style={{ color: '#FF3333' }} /><span className="text-[12px] font-bold">Нажми — исчезнет</span>
                        </button>
                      )}
                      {m.is_disappearing && mine && <span className="absolute bottom-1 right-2 text-[10px] font-bold text-white/80 flex items-center gap-0.5"><i className="ph-fill ph-fire" />исчезающее</span>}
                    </>
                  ) : null}
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[75%] px-3.5 py-2.5 text-[14px] font-medium leading-snug ' + (mine ? 'rounded-2xl rounded-tr-none text-white' : 'rounded-2xl rounded-tl-none')}
                style={mine ? { background: adult ? 'linear-gradient(135deg,#FF3333,#FF00FF)' : 'linear-gradient(135deg,#FF00FF,#FF66CC)' } : { background: adult ? '#2a1010' : '#f3f4f6', color: adult ? '#fff' : '#0F0F13' }}>
                {m.content}
              </div>
            </div>
          )
        })}
        {consentFrom && (
          <div className="flex justify-center py-2">
            <div className="rounded-2xl px-4 py-3 max-w-[85%] text-center" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <div className="text-[24px]">🔑</div>
              <p className="text-[13px] font-semibold text-[#0F0F13] mt-1">Собеседник хочет в Telegram</p>
              <div className="flex gap-2 mt-3">
                <button onClick={declineTg} className="flex-1 h-9 rounded-xl bg-white border border-[#e5e7eb] text-[13px] font-bold text-[#6b7280]">Отклонить</button>
                <button onClick={approveTg} className="flex-1 h-9 rounded-xl text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>Одобрить</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {noMsgsYet && ices.length > 0 && (
        <div className="shrink-0 px-3 pb-2 flex gap-2 overflow-x-auto noscroll">
          {ices.map((q) => (
            <button key={q} onClick={() => send(q)} className="shrink-0 px-3 h-9 rounded-full text-[12.5px] font-semibold whitespace-nowrap active:scale-95 transition"
              style={{ color: accent, background: adult ? 'rgba(255,51,51,0.1)' : 'rgba(255,0,255,0.08)', border: `1px solid ${adult ? 'rgba(255,51,51,0.3)' : 'rgba(255,0,255,0.25)'}` }}>{q}</button>
          ))}
        </div>
      )}

      <div className="shrink-0 px-3 pt-2 flex items-center gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)', background: adult ? 'rgba(20,0,0,0.6)' : 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => !sending && fileRef.current?.click()} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: adult ? '#2a1010' : '#f3f4f6' }}>
          <i className={'ph-fill ' + (sending ? 'ph-spinner animate-spin' : (adult ? 'ph-fire' : 'ph-paperclip')) + ' text-[18px]'} style={{ color: adult ? '#FF3333' : '#6b7280' }} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) sendMedia(f); e.target.value = '' }} />
        <input value={text} onChange={(e) => { setText(e.target.value); const now = Date.now(); if (now - lastTypingSent.current > 1800) { lastTypingSent.current = now; wsRef.current?.send?.({ type: 'typing' }) } }} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Сообщение…"
          className="flex-1 h-11 rounded-full px-4 text-[14px] font-medium outline-none" style={{ background: adult ? '#2a1010' : '#fff', color: adult ? '#fff' : '#0F0F13', border: adult ? '1px solid #4A0000' : '1px solid #e5e7eb' }} />
        <button onClick={() => send()} className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition" style={{ background: adult ? 'linear-gradient(135deg,#FF3333,#FF00FF)' : 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
          <i className="ph-fill ph-paper-plane-right text-[18px] text-white" />
        </button>
      </div>
    </div>
  )
}
