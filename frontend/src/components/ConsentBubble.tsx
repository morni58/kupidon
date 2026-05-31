import { api } from '../api/client'

interface Props { matchId: string; fromId: string; onDone: () => void }

export function ConsentBubble({ matchId, fromId, onDone }: Props) {
  async function approve() {
    await api.post(`/api/chats/${matchId}/approve_tg`)
    onDone()
  }
  async function decline() { onDone() }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mx-2 my-2 text-center shadow-sm">
      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm mx-auto mb-2">🔑</div>
      <p className="text-sm font-bold text-blue-900 mb-3">Собеседник хочет в Telegram</p>
      <div className="flex gap-2 justify-center">
        <button onClick={decline}
          className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold">Отклонить</button>
        <button onClick={approve}
          className="text-white px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>Одобрить</button>
      </div>
    </div>
  )
}
