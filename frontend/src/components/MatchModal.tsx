import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

function haptic(t: 'heavy') { try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(t) } catch {} }

interface Props { matchId: string; partnerName: string; onClose: () => void }

export function MatchModal({ matchId, partnerName, onClose }: Props) {
  const navigate = useNavigate()
  haptic('heavy')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.85)' }}
      >
        {/* Confetti-like circles */}
        {[...Array(20)].map((_, i) => (
          <motion.div key={i}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ scale: Math.random() * 2 + 0.5, x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 600, opacity: 0 }}
            transition={{ duration: 1.5, delay: Math.random() * 0.3 }}
            className="absolute w-3 h-3 rounded-full"
            style={{ background: ['#FF00FF','#FF66CC','#FFD700','#10B981'][i % 4] }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="bg-white rounded-[2rem] p-8 mx-6 text-center shadow-2xl"
        >
          <div className="text-6xl mb-4">💕</div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Совпадение!</h2>
          <p className="text-gray-500 font-medium mb-6">Вы с <b>{partnerName}</b> понравились друг другу</p>
          <button onClick={() => { navigate(`/chats/${matchId}`); onClose() }}
            className="w-full py-3 rounded-2xl text-white font-bold text-lg mb-3"
            style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
            💬 Написать первым
          </button>
          <button onClick={onClose} className="text-gray-400 font-medium text-sm">Продолжить свайпать</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
