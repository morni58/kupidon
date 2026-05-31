import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'

interface Props { reason: string; onClose: () => void }

export function PaywallModal({ reason, onClose }: Props) {
  async function buyStars(product: string) {
    try {
      const res = await api.post<{ invoice_payload: string; stars: number }>('/api/payments/create_invoice', { product })
      // In real Telegram: window.Telegram.WebApp.openInvoice(...)
      alert(`Оплата ${res.stars} Stars за ${product} (stub). payload: ${res.invoice_payload}`)
    } catch {
      alert('Ошибка платежа')
    }
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center pb-0"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full bg-white rounded-t-[2rem] p-8 pb-12"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
          <h2 className="text-2xl font-black text-center mb-2">🔓 Открой CupidBot</h2>
          <p className="text-gray-500 text-center mb-6 font-medium">{reason}</p>

          <div className="space-y-3">
            <button onClick={() => buyStars('premium_month')}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg"
              style={{ background: 'linear-gradient(135deg,#FF00FF,#FF66CC)' }}>
              💎 Premium — 200 свайпов/день
            </button>
            <button onClick={() => buyStars('kupidon_month')}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg"
              style={{ background: 'linear-gradient(135deg,#FFE259,#FFA751)' }}>
              👑 Kupidon VIP — 500 свайпов + Олигарх
            </button>
            <button onClick={onClose}
              className="w-full py-3 text-gray-400 font-medium">
              Остаться на Free
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
