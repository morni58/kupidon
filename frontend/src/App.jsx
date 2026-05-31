import { useEffect } from 'react'
import { useStore } from './lib/store'
import { api, tg } from './lib/api'
import { registerTags } from './design/data'
import { Toast } from './design/ui'
import { Onboarding } from './screens/Onboarding'
import { Feed } from './screens/Feed'
import { Likes, Chats, Dialog } from './screens/Social'
import { Profile, Verification, Pricing } from './screens/Profile'

export default function App() {
  const s = useStore()
  const setToast = s.setToast

  useEffect(() => {
    try { tg?.ready?.(); tg?.expand?.() } catch {}
    // preload tag catalog so emoji/colors resolve everywhere
    api.getTags().then(registerTags).catch(() => {})

    async function boot() {
      const initData = tg?.initData
      try {
        if (initData) {
          const res = await api.authTelegram(initData)
          s.setToken(res.access_token)
          if (res.is_new_user) { s.setScreen('onboarding'); return }
        } else if (!s.token) {
          // No Telegram context and no token — show onboarding shell (dev)
          s.setScreen('onboarding'); return
        }
        const me = await api.getMe()
        s.setActiveChat(null)
        useStore.setState({ me })
        if (!me.birth_date) s.setScreen('onboarding')
        else s.setScreen('feed')
      } catch {
        s.setScreen('onboarding')
      }
    }
    boot()
  }, [])

  const theme = s.theme()
  const plan = s.plan()
  const me = s.me
  const dots = { likes: true, chats: false }
  const prefs = { vibe: s.vibe, frame: s.frame, anthem: s.anthem }
  const onTab = (id) => s.setScreen(id)
  const refreshMe = () => s.refreshMe()

  let view = null
  switch (s.screen) {
    case 'loading':
      view = <div className="w-full h-full flex items-center justify-center" style={{ background: '#FAFAFC' }}>
        <div className="text-[44px] floaty">💕</div>
      </div>; break
    case 'onboarding':
      view = <Onboarding setToast={setToast} onDone={async () => { await s.refreshMe(); s.setScreen('feed') }} />; break
    case 'feed':
      view = <Feed theme={theme} plan={plan} me={me} refreshMe={refreshMe} setToast={setToast} dots={dots} active="feed" onTab={onTab}
        onMatch={(matchId) => s.openChat(matchId)} onUpgrade={(product) => s.setScreen('pricing')} />; break
    case 'likes':
      view = <Likes plan={plan} me={me} setToast={setToast} dots={dots} active="likes" onTab={onTab} onOpenChat={(id) => s.openChat(id)} />; break
    case 'chats':
      view = <Chats dots={dots} active="chats" onTab={onTab} onOpenChat={(id) => s.openChat(id)} />; break
    case 'dialog':
      view = <Dialog chatId={s.activeChat} me={me} plan={plan} setToast={setToast} onBack={() => s.setScreen('chats')} />; break
    case 'profile':
      view = <Profile theme={theme} plan={plan} prefs={prefs} setPref={s.setPref} setToast={setToast} dots={dots} active="profile" onTab={onTab}
        onVerify={() => s.setScreen('verify')} onUpgrade={() => s.setScreen('pricing')} onMutate={refreshMe} />; break
    case 'verify':
      view = <Verification setToast={setToast} onBack={() => s.setScreen('profile')} onSuccess={async () => { await s.refreshMe(); setToast('✓ Синяя галочка добавлена'); s.setScreen('profile') }} />; break
    case 'pricing':
      view = <Pricing currentTier={me?.tier} setToast={setToast} onMutate={refreshMe} onBack={() => s.setScreen('profile')} />; break
    default: view = null
  }

  return (
    <div className="w-full h-full relative">
      <div key={s.screen} className="w-full h-full">{view}</div>
      <Toast toast={s.toast} />
    </div>
  )
}
