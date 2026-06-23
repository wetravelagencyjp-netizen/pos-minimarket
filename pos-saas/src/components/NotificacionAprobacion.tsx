'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface Notif {
  tipo: 'aprobada' | 'rechazada'
  mensaje: string
}

export default function NotificacionAprobacion() {
  const { usuario } = useAuth()
  const router = useRouter()
  const [notif, setNotif] = useState<Notif | null>(null)

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
          setNotif({ tipo: 'aprobada', mensaje: 'Venta aprobada por el dueño' })
        } else if (payload.new?.estado === 'rechazada') {
          setNotif({ tipo: 'rechazada', mensaje: 'Solicitud rechazada por el dueño' })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [usuario?.id])

  if (!notif) return null

  const esAprobada = notif.tipo === 'aprobada'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className={`flex items-center gap-3 rounded-2xl shadow-xl px-5 py-3.5 text-white ${
        esAprobada
          ? 'bg-emerald-600 shadow-emerald-900/40'
          : 'bg-rose-600 shadow-rose-900/40'
      }`}>
        <span className="text-xl">{esAprobada ? '✅' : '❌'}</span>
        <div>
          <p className="text-sm font-semibold">{notif.mensaje}</p>
          <p className={`text-xs ${esAprobada ? 'text-emerald-200' : 'text-rose-200'}`}>
            {esAprobada ? 'Toca para completarla ahora' : 'La solicitud fue cancelada'}
          </p>
        </div>
        {esAprobada && (
          <button
            onClick={() => { setNotif(null); router.push('/caja/solicitudes') }}
            className="ml-2 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Ver
          </button>
        )}
        <button
          onClick={() => setNotif(null)}
          className={`text-lg leading-none px-1 ${esAprobada ? 'text-emerald-200 hover:text-white' : 'text-rose-200 hover:text-white'}`}
        >
          ✕
        </button>
      </div>
    </div>
  )
}