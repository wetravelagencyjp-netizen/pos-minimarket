'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function NotificacionAprobacion() {
  const { usuario } = useAuth()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [cantidad, setCantidad] = useState(0)

  useEffect(() => {
    if (!usuario?.id) return

    const canal = supabase
      .channel('notif-aprobacion-cajero')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'solicitudes_autorizacion',
        filter: `cajero_id=eq.${usuario.id}`,
      }, (payload) => {
        if (payload.new?.estado === 'aprobada') {
          setCantidad((prev) => prev + 1)
          setVisible(true)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [usuario?.id])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce-once">
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-900/40 px-5 py-3.5 text-white">
        <span className="text-xl">✅</span>
        <div>
          <p className="text-sm font-semibold">
            {cantidad > 1 ? `${cantidad} ventas aprobadas` : 'Venta aprobada por el dueño'}
          </p>
          <p className="text-xs text-emerald-200">Toca para completarla ahora</p>
        </div>
        <button
          onClick={() => { setVisible(false); setCantidad(0); router.push('/caja/solicitudes') }}
          className="ml-2 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Ver
        </button>
        <button
          onClick={() => setVisible(false)}
          className="text-emerald-200 hover:text-white text-lg leading-none px-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}