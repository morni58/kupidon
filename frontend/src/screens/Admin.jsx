import { useState, useEffect } from 'react'
import { api, haptic, mediaUrl } from '../lib/api'

const C = { bg: '#0B0712', card: 'rgba(255,255,255,0.05)', bd: 'rgba(255,255,255,0.1)', txt: '#fff', sub: 'rgba(255,255,255,0.6)', accent: '#A855F7' }
const ROLE_RU = { user: 'Пользователь', moderator: '🛡️ Модератор', admin: '⭐ Админ', owner: '👑 Владелец' }

function Btn({ onClick, children, color = '#6366F1', disabled, small }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="rounded-xl font-bold active:scale-95 transition disabled:opacity-40"
      style={{ background: color, color: '#fff', padding: small ? '6px 10px' : '9px 12px', fontSize: small ? 12 : 13 }}>
      {children}
    </button>
  )
}

function Pill({ children, color }) {
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: color + '22', color }}>{children}</span>
}

function UserCard({ u, level, onAct, setToast }) {
  const [busy, setBusy] = useState(false)
  async function act(body) {
    setBusy(true); haptic('light')
    try { const r = await api.adminUserAction(u.id, body); setToast?.(r.message || 'Готово'); onAct?.(r.user) }
    catch (e) { setToast?.(e?.data?.detail || 'Ошибка') }
    setBusy(false)
  }
  const muted = u.muted_until && new Date(u.muted_until) > new Date()
  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: C.card, border: `1px solid ${C.bd}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-black text-[15px]" style={{ color: C.txt }}>{u.name}</span>
        <span className="text-[12px]" style={{ color: C.sub }}>@{u.username || '—'} · {u.tg_id}</span>
        {u.role !== 'user' && <Pill color="#A855F7">{ROLE_RU[u.role]}</Pill>}
        {u.is_verified && <Pill color="#3B82F6">✓</Pill>}
        {{ premium: <Pill color="#FF00FF">💎</Pill>, kupidon: <Pill color="#FFD700">👑</Pill> }[u.tier]}
        {u.is_banned && <Pill color="#EF4444">бан</Pill>}
        {u.is_shadowbanned && <Pill color="#9ca3af">👻</Pill>}
        {muted && <Pill color="#F59E0B">🔇</Pill>}
      </div>
      <div className="text-[11px] mt-1" style={{ color: C.sub }}>
        ⭐{u.profile_score} · доверие {u.trust_score} · варнов {u.warns} · смен(город/пол) {u.city_changes}/{u.gender_changes}
        {u.needs_review && ' · ⚠️ на ревью'}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {u.is_banned
          ? <Btn small color="#10B981" disabled={busy} onClick={() => act({ action: 'unban' })}>♻️ Разбан</Btn>
          : <Btn small color="#EF4444" disabled={busy} onClick={() => act({ action: 'ban', reason: 'Нарушение правил' })}>🚫 Бан</Btn>}
        <Btn small color="#6B7280" disabled={busy} onClick={() => act({ action: 'shadow' })}>👻 Shadow</Btn>
        <Btn small color="#F59E0B" disabled={busy} onClick={() => act({ action: 'warn' })}>⚠️ Варн</Btn>
        {muted
          ? <Btn small color="#10B981" disabled={busy} onClick={() => act({ action: 'unmute' })}>🔊 Размьют</Btn>
          : <Btn small color="#F59E0B" disabled={busy} onClick={() => act({ action: 'mute', hours: 24 })}>🔇 Мьют 24ч</Btn>}
        {u.is_verified
          ? <Btn small color="#6B7280" disabled={busy} onClick={() => act({ action: 'unverify' })}>Снять ✓</Btn>
          : <Btn small color="#3B82F6" disabled={busy} onClick={() => act({ action: 'verify' })}>✅ Галочка</Btn>}
      </div>
      {level >= 2 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5 pt-1.5" style={{ borderTop: `1px dashed ${C.bd}` }}>
          <Btn small color="#FF00FF" disabled={busy} onClick={() => act({ action: 'give', product: 'premium_month', days: 30 })}>💎 +Premium</Btn>
          <Btn small color="#B8860B" disabled={busy} onClick={() => act({ action: 'give', product: 'kupidon_month', days: 30 })}>👑 +Kupidon</Btn>
          <Btn small color="#6366F1" disabled={busy} onClick={() => act({ action: 'stars', amount: 100 })}>⭐ +100</Btn>
          <Btn small color="#10B981" disabled={busy} onClick={() => act({ action: 'give', product: 'boost' })}>🚀 Буст</Btn>
        </div>
      )}
      {level >= 2 && u.role !== 'owner' && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {u.role !== 'moderator' && <Btn small color="#8B5CF6" disabled={busy} onClick={() => act({ action: 'role', role: 'moderator' })}>🛡️ → Модератор</Btn>}
          {level >= 3 && u.role !== 'admin' && <Btn small color="#A855F7" disabled={busy} onClick={() => act({ action: 'role', role: 'admin' })}>⭐ → Админ</Btn>}
          {u.role !== 'user' && <Btn small color="#6B7280" disabled={busy} onClick={() => act({ action: 'role', role: 'user' })}>Снять роль</Btn>}
        </div>
      )}
    </div>
  )
}

export function Admin({ onBack, setToast }) {
  const [tab, setTab] = useState('stats')
  const [level, setLevel] = useState(1)
  const [data, setData] = useState({})
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)

  useEffect(() => { api.adminWhoami().then((w) => setLevel(w.level)).catch(() => {}) }, [])

  const load = async () => {
    try {
      if (tab === 'stats') setData({ stats: await api.adminStats() })
      else if (tab === 'reports') setData({ reports: await api.adminReports() })
      else if (tab === 'verify') setData({ verify: await api.adminVerifyQueue() })
      else if (tab === 'audit') setData({ audit: await api.adminAudit() })
    } catch (e) { setToast?.(e?.data?.detail || 'Нет доступа') }
  }
  useEffect(() => { load() }, [tab])

  async function search() {
    if (q.trim().length < 1) return
    try { setResults(await api.adminSearch(q.trim())) } catch (e) { setToast?.('Ошибка поиска') }
  }
  async function reportAct(rep, body) {
    haptic('light')
    try {
      if (body) { const r = await api.adminUserAction(rep.target.id, body); setToast?.(r.message) }
      await api.adminDismissReport(rep.id)
      setData((d) => ({ ...d, reports: (d.reports || []).filter((x) => x.id !== rep.id) }))
    } catch (e) { setToast?.(e?.data?.detail || 'Ошибка') }
  }
  async function verifyAct(u, grant) {
    haptic('light')
    try {
      await api.adminUserAction(u.id, { action: grant ? 'verify' : 'unverify' })
      if (!grant) { /* deny: just clear request via unverify path already nulls request */ }
      setToast?.(grant ? '✅ Выдано' : '❌ Отклонено')
      setData((d) => ({ ...d, verify: (d.verify || []).filter((x) => x.id !== u.id) }))
    } catch (e) { setToast?.('Ошибка') }
  }

  const TABS = [['stats', '📊'], ['reports', '🚩'], ['users', '👤'], ['verify', '🔵'], ['audit', '📜']]

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: C.bg }}>
      <div className="relative z-10 w-full h-full overflow-y-auto noscroll" style={{ paddingBottom: 24 }}>
        <div className="safe-top screen-pad pb-2 flex items-center gap-3 sticky top-0 z-20" style={{ background: C.bg }}>
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style={{ background: C.card }}>
            <i className="ph-bold ph-arrow-left text-[18px] text-white" />
          </button>
          <h1 className="text-[20px] font-black text-white">Модерация</h1>
          <span className="ml-auto"><Pill color="#A855F7">{ROLE_RU[['user', 'moderator', 'admin', 'owner'][level]]}</Pill></span>
        </div>

        {/* tabs */}
        <div className="flex gap-1.5 px-4 pb-3">
          {TABS.map(([id, ic]) => (
            <button key={id} onClick={() => { setTab(id); haptic('light') }}
              className="flex-1 rounded-xl py-2 text-[16px] active:scale-95 transition"
              style={{ background: tab === id ? C.accent : C.card, border: `1px solid ${tab === id ? C.accent : C.bd}` }}>{ic}</button>
          ))}
        </div>

        <div className="screen-pad">
          {/* STATS */}
          {tab === 'stats' && data.stats && (
            <div className="grid grid-cols-2 gap-2.5">
              {[['Всего', data.stats.total], ['Активных 24ч', data.stats.dau], ['Premium', data.stats.premium], ['Kupidon', data.stats.kupidon],
                ['Свайпов 24ч', data.stats.swipes_24h], ['Открытых жалоб', data.stats.open_reports], ['Заявок ✓', data.stats.pending_verify], ['Забанено', data.stats.banned]].map(([l, v], i) => (
                <div key={i} className="rounded-2xl p-3" style={{ background: C.card, border: `1px solid ${C.bd}` }}>
                  <div className="text-[24px] font-black" style={{ color: C.accent }}>{v}</div>
                  <div className="text-[12px]" style={{ color: C.sub }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* REPORTS */}
          {tab === 'reports' && (
            <div>
              {(data.reports || []).length === 0 && <p className="text-center py-10" style={{ color: C.sub }}>Открытых жалоб нет 🎉</p>}
              {(data.reports || []).map((r) => (
                <div key={r.id} className="rounded-2xl p-3 mb-2.5" style={{ background: C.card, border: `1px solid ${C.bd}` }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill color="#EF4444">{r.reason}</Pill>
                    <span className="text-[12px]" style={{ color: C.sub }}>жалоб: {r.distinct_reports}</span>
                  </div>
                  {r.note && <div className="text-[13px] mt-1.5 italic" style={{ color: C.txt }}>«{r.note}»</div>}
                  {r.target && <div className="text-[13px] mt-1.5 font-bold" style={{ color: C.txt }}>👤 {r.target.name} (@{r.target.username || '—'}) · {r.target.tg_id}</div>}
                  {r.reporter && <div className="text-[12px]" style={{ color: C.sub }}>🙋 от {r.reporter.name} (@{r.reporter.username || '—'})</div>}
                  {r.messages?.length > 0 && (
                    <div className="mt-2 rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      {r.messages.map((m, i) => (
                        <div key={i} className="text-[12px]" style={{ color: m.who === 'target' ? '#F87171' : C.sub }}>
                          <b>{m.who === 'target' ? 'наруш.' : m.who === 'reporter' ? 'жалоб.' : '?'}:</b> {m.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <Btn small color="#EF4444" onClick={() => reportAct(r, { action: 'ban', reason: r.reason })}>🚫 Бан</Btn>
                    <Btn small color="#6B7280" onClick={() => reportAct(r, { action: 'shadow' })}>👻 Shadow</Btn>
                    <Btn small color="#F59E0B" onClick={() => reportAct(r, { action: 'warn' })}>⚠️ Варн</Btn>
                    <Btn small color="#10B981" onClick={() => reportAct(r, null)}>✅ Отклонить</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* USERS */}
          {tab === 'users' && (
            <div>
              <div className="flex gap-2 mb-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Имя, @username или tg_id" className="flex-1 rounded-xl px-3 py-2.5 text-[14px] outline-none"
                  style={{ background: C.card, border: `1px solid ${C.bd}`, color: C.txt }} />
                <Btn color={C.accent} onClick={search}>Найти</Btn>
              </div>
              {results === null && <p className="text-center py-8" style={{ color: C.sub }}>Найди пользователя для модерации</p>}
              {results?.length === 0 && <p className="text-center py-8" style={{ color: C.sub }}>Никого не найдено</p>}
              {(results || []).map((u) => (
                <UserCard key={u.id} u={u} level={level} setToast={setToast}
                  onAct={(nu) => nu && setResults((rs) => rs.map((x) => x.id === nu.id ? nu : x))} />
              ))}
            </div>
          )}

          {/* VERIFY */}
          {tab === 'verify' && (
            <div>
              {(data.verify || []).length === 0 && <p className="text-center py-10" style={{ color: C.sub }}>Очередь пуста</p>}
              {(data.verify || []).map((u) => (
                <div key={u.id} className="rounded-2xl p-3 mb-2.5" style={{ background: C.card, border: `1px solid ${C.bd}` }}>
                  <div className="font-bold text-[14px]" style={{ color: C.txt }}>{u.name} (@{u.username || '—'}) · {u.tg_id}</div>
                  {u.selfie && <a href={u.selfie} target="_blank" rel="noreferrer" className="text-[12px] underline" style={{ color: C.accent }}>Открыть селфи</a>}
                  <div className="flex gap-2 mt-2">
                    <Btn small color="#3B82F6" onClick={() => verifyAct(u, true)}>✅ Выдать</Btn>
                    <Btn small color="#6B7280" onClick={() => verifyAct(u, false)}>❌ Отклонить</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AUDIT */}
          {tab === 'audit' && (
            <div>
              {(data.audit || []).map((a) => (
                <div key={a.id} className="rounded-xl p-2.5 mb-1.5 text-[12.5px]" style={{ background: C.card, border: `1px solid ${C.bd}`, color: C.txt }}>
                  <b style={{ color: C.accent }}>{a.action}</b> · {a.actor} → {a.target || '—'} {a.detail ? `(${a.detail})` : ''}
                  <div className="text-[10.5px]" style={{ color: C.sub }}>{a.created_at ? new Date(a.created_at).toLocaleString('ru-RU') : ''}</div>
                </div>
              ))}
              {(data.audit || []).length === 0 && <p className="text-center py-10" style={{ color: C.sub }}>Лог пуст</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
