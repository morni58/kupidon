import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/feed', icon: '🃏', label: 'Лента' },
  { path: '/sympathies', icon: '❤️', label: 'Симпатии' },
  { path: '/chats', icon: '💬', label: 'Чаты' },
  { path: '/profile', icon: '👤', label: 'Профиль' },
]

export function TabBar({ badges = {} }: { badges?: Record<string, number> }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around px-4 z-50"
      style={{ background: 'var(--tabbar-bg)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      {tabs.map(tab => {
        const active = pathname.startsWith(tab.path)
        const badge = badges[tab.path] || 0
        return (
          <button key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-1 relative transition-all ${active ? 'scale-110' : 'opacity-50'}`}>
            <span className="text-2xl">{tab.icon}</span>
            <span className={`text-[10px] font-bold ${active ? 'text-[var(--accent)]' : ''}`}>{tab.label}</span>
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
