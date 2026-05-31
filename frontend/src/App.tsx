import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { api } from './api/client'
import { TabBar } from './components/TabBar'
import { Feed } from './screens/Feed'
import { Sympathies } from './screens/Sympathies'
import { Chats } from './screens/Chats'
import { ChatDialog } from './screens/ChatDialog'
import { Profile } from './screens/Profile'
import { Onboarding } from './screens/Onboarding'
import { VerifyFlow } from './screens/VerifyFlow'
import './i18n'

const HIDE_TABS = ['/onboarding', '/verify', '/chats/']

export default function App() {
  const { token, user, setToken, setUser } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) {
      tg.expand()
      tg.ready()
    }

    async function auth() {
      const initData = tg?.initData
      if (!initData && token) {
        // Dev mode: use existing token
        try {
          const u = await api.get<any>('/api/profile/me')
          setUser(u)
          if (!u.birth_date) navigate('/onboarding')
        } catch { /* expired */ }
        return
      }
      if (!initData) return

      try {
        const res = await api.post<{ access_token: string; is_new_user: boolean }>('/api/auth/telegram', { init_data: initData })
        setToken(res.access_token)
        if (res.is_new_user) { navigate('/onboarding'); return }
        const u = await api.get<any>('/api/profile/me')
        setUser(u)
        if (!u.birth_date) navigate('/onboarding')
      } catch (e) {
        console.error('Auth failed', e)
      }
    }
    auth()
  }, [])

  const showTabs = !HIDE_TABS.some(p => location.pathname.startsWith(p))

  return (
    <div className="h-full flex flex-col relative">
      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/sympathies" element={<Sympathies />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/chats/:matchId" element={<ChatDialog />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/verify" element={<VerifyFlow />} />
      </Routes>
      {showTabs && <TabBar />}
    </div>
  )
}
