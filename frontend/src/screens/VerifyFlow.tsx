import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'

const GESTURES = ['Коснись щеки 👆', 'Повернись влево ←', 'Улыбнись 😊', 'Подними руку ✋']

export function VerifyFlow() {
  const [gesture] = useState(() => GESTURES[Math.floor(Math.random() * GESTURES.length)])
  const [step, setStep] = useState<'intro' | 'recording' | 'done' | 'fail'>('intro')
  const setUser = useStore(s => s.setUser)
  const navigate = useNavigate()

  async function startVerify() {
    setStep('recording')
    await new Promise(r => setTimeout(r, 2000)) // simulate camera
    try {
      await api.post('/api/verify/selfie')
      const updated = await api.get<any>('/api/profile/me')
      setUser(updated)
      setStep('done')
    } catch { setStep('fail') }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-8 text-center">
      {step === 'intro' && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-40 h-40 rounded-full border-4 border-dashed border-blue-300 flex items-center justify-center mb-6 relative mx-auto">
            <span className="text-6xl">🤳</span>
            <div className="absolute -bottom-3 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              {gesture}
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2">Подтверди, что это ты</h2>
          <p className="text-gray-400 text-sm mb-6">Повтори жест. Кадры не сохраняются — только разовая сверка.</p>
          <button onClick={startVerify}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            📷 Начать
          </button>
          <p className="mt-3 text-blue-600 font-bold text-sm">✓ Синяя галочка +15 к анкете</p>
        </motion.div>
      )}

      {step === 'recording' && (
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
          <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-red-500 rounded-full animate-pulse" />
          </div>
          <p className="font-bold text-blue-900">Идёт проверка...</p>
        </motion.div>
      )}

      {step === 'done' && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-black mb-2 text-blue-900">Верифицирован!</h2>
          <p className="text-gray-400 mb-6">Синяя галочка добавлена к твоему профилю</p>
          <button onClick={() => navigate('/profile')}
            className="w-full py-4 rounded-2xl text-white font-bold"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            В профиль
          </button>
        </motion.div>
      )}

      {step === 'fail' && (
        <div>
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-black mb-4">Не удалось. Попробуй снова.</h2>
          <button onClick={() => setStep('intro')}
            className="w-full py-4 rounded-2xl text-white font-bold"
            style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>Повторить</button>
        </div>
      )}
    </div>
  )
}
