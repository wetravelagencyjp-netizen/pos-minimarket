'use client'

import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { validarPinCajero } from '@/core/hooks/useBloqueoPIN'

interface Props {
  nombreUsuario: string
  onDesbloqueado: () => void
}

export default function PantallaBloqueoPIN({ nombreUsuario, onDesbloqueado }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validando, setValidando] = useState(false)

  const presionarTecla = (tecla: string) => {
    if (tecla === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    setPin(p => p + tecla)
  }

  const validar = async () => {
    setValidando(true)
    setError(null)
    const resultado = await validarPinCajero(pin)
    setValidando(false)
    if (resultado.autorizado) {
      setPin('')
      onDesbloqueado()
    } else {
      setError(resultado.error ?? 'PIN incorrecto')
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center">
            <Lock size={28} className="text-zinc-400" />
          </div>
          <p className="text-white font-semibold text-lg">{nombreUsuario}</p>
          <p className="text-zinc-500 text-sm">Ingresa tu PIN para continuar</p>
        </div>

        <div className="flex justify-center gap-4">
          {[0, 1, 2, 3].map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? 'bg-indigo-400 scale-110' : 'bg-zinc-700'}`} />
          ))}
        </div>

        {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((tecla, i) => (
            <button
              key={i}
              onClick={() => tecla && presionarTecla(tecla)}
              disabled={!tecla}
              className={`h-14 rounded-2xl text-xl font-semibold transition-all ${
                tecla === '⌫'
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95'
                  : tecla
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700 active:scale-95 active:bg-zinc-600'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              {tecla}
            </button>
          ))}
        </div>

        <button
          onClick={validar}
          disabled={pin.length < 4 || validando}
          className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
        >
          <Unlock size={16} />
          {validando ? 'Verificando…' : 'Desbloquear'}
        </button>
      </div>
    </div>
  )
}