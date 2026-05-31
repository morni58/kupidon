import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'

export function Profile() {
  const { user, setUser, setTheme, theme } = useStore()
  const navigate = useNavigate()
  const [views, setViews] = useState<{ count: number; is_premium: boolean }>({ count: 0, is_premium: false })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<any>('/api/profile/me').then(setUser).catch(() => {})
    api.get<any>('/api/views/me').then(d => setViews({ count: d.count, is_premium: d.is_premium })).catch(() => {})
  }, [])

  async function toggle18() {
    if (!user?.is_verified) { alert('Требуется верификация для 18+ режима'); return }
    try {
      const updated = await api.patch<any>('/api/profile/me', { is_18_mode_active: !user.is_18_mode_active })
      setUser(updated)
      setTheme(updated.is_18_mode_active ? 'room18' : 'light')
    } catch (e: any) { alert(e.message) }
  }

  async function toggleAntiOligarch() {
    try {
      const updated = await api.patch<any>('/api/profile/me', { is_anti_oligarch: !user?.is_anti_oligarch })
      setUser(updated)
    } catch (e: any) { alert(e.message) }
  }

  async function toggleStealth() {
    try {
      const updated = await api.patch<any>('/api/profile/me', { is_stealth_mode: !user?.is_stealth_mode })
      setUser(updated)
      setTheme(updated.is_stealth_mode ? 'oligarch' : 'light')
    } catch (e: any) { alert(e.message) }
  }

  async function doVerify() {
    setLoading(true)
    try {
      await api.post('/api/verify/selfie')
      const updated = await api.get<any>('/api/profile/me')
      setUser(updated)
      alert('✅ Верификация пройдена!')
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  if (!user) return <div className="h-full flex items-center justify-center text-gray-400">Загрузка...</div>

  const tierColors: Record<string, string> = { free: '#6b7280', premium: '#FF00FF', kupidon: '#FFD700' }
  const tierLabel: Record<string, string> = { free: 'Free', premium: 'Premium 💎', kupidon: 'Kupidon 👑' }

  return (
    <div className="h-full overflow-y-auto pb-20" style={{ background: 'var(--bg)' }}>
      {/* Header card */}
      <div className="mx-4 mt-4 bg-white rounded-[2rem] p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF00FF] to-[#FF66CC] flex items-center justify-center text-white text-2xl font-black shrink-0">
            {user.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{user.name}</h2>
              {user.is_verified && <span className="text-blue-500 text-sm">✓</span>}
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: tierColors[user.tier] }}>
              {tierLabel[user.tier]}
            </span>
          </div>
          <div className="ml-auto text-center">
            <div className="text-2xl font-black" style={{ color: '#FF00FF' }}>{user.profile_score}%</div>
            <div className="text-xs text-gray-400">горячесть</div>
          </div>
        </div>

        {/* Profile score bar */}
        <div className="mt-4 bg-gray-100 rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{ width: `${user.profile_score}%`, background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }} />
        </div>
        {user.profile_score < 60 && (
          <p className="text-xs text-gray-400 mt-1">Добавь видео и пройди верификацию для 100%</p>
        )}

        {/* Streak */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-orange-500">🔥</span>
          <span className="text-sm font-bold">{user.streak_days} дней подряд</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Свайпов', value: user.swipes_left },
          { label: 'Суперлайков', value: user.superlikes_left },
          { label: 'Просмотров', value: views.count },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <div className="text-xl font-black text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Verification */}
      {!user.is_verified && (
        <div className="mx-4 mt-3 bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center gap-3">
          <div className="text-2xl">🔵</div>
          <div className="flex-1">
            <p className="font-bold text-blue-900 text-sm">Получи синюю галочку</p>
            <p className="text-xs text-blue-600">+15 к горячести, фильтр Verified</p>
          </div>
          <button onClick={doVerify} disabled={loading}
            className="text-white text-xs font-bold px-3 py-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            {loading ? '...' : 'Верифицировать'}
          </button>
        </div>
      )}

      {/* Toggles */}
      <div className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm space-y-4">
        {/* 18+ */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-red-700">🔞 Комната 18+</p>
            <p className="text-xs text-gray-400">Только verified-пользователи</p>
          </div>
          <button onClick={toggle18}
            className={`w-12 h-6 rounded-full transition-all ${user.is_18_mode_active ? 'bg-red-500' : 'bg-gray-200'} flex items-center ${user.is_18_mode_active ? 'justify-end pr-1' : 'pl-1'}`}>
            <div className="w-4 h-4 bg-white rounded-full shadow" />
          </button>
        </div>

        {/* Anti-oligarch (female only) */}
        {user.gender === 'female' || true ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-emerald-700">🛡 Анти-Олигарх Щит</p>
              <p className="text-xs text-gray-400">Бесплатно для девушек ♀</p>
            </div>
            <button onClick={toggleAntiOligarch}
              className={`w-12 h-6 rounded-full transition-all ${user.is_anti_oligarch ? 'bg-emerald-500' : 'bg-gray-200'} flex items-center ${user.is_anti_oligarch ? 'justify-end pr-1' : 'pl-1'}`}>
              <div className="w-4 h-4 bg-white rounded-full shadow" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Oligarch panel (Kupidon only) */}
      {user.is_oligarch_mode && (
        <div className="mx-4 mt-3 rounded-2xl p-5 text-white" style={{ background: '#141416', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">👑</span>
            <span className="font-black" style={{ color: '#FFD700' }}>Режим Олигарх</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-sm">🕵 Стелс-режим</div>
              <div className="text-xs text-gray-500">Невидим в общей ленте</div>
            </div>
            <button onClick={toggleStealth}
              className={`w-12 h-6 rounded-full transition-all flex items-center ${user.is_stealth_mode ? 'justify-end pr-1' : 'pl-1'}`}
              style={{ background: user.is_stealth_mode ? '#FFD700' : '#333' }}>
              <div className="w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
          <div className="rounded-xl p-3 text-xs flex justify-between" style={{ background: 'rgba(255,215,0,0.08)', color: '#FFD700' }}>
            <span>VIP-сигналов сегодня: {user.vip_signals_used} / 20</span>
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      {user.tier === 'free' && (
        <div className="mx-4 mt-3 rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
          <p className="font-black text-lg">Стань Купидоном 💘</p>
          <p className="text-sm opacity-80 mb-3">500 свайпов, Олигарх режим, 15 врывов</p>
          <button className="bg-white text-[#FF00FF] font-black px-4 py-2 rounded-xl text-sm">
            Открыть тарифы
          </button>
        </div>
      )}
    </div>
  )
}
