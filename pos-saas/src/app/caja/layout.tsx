'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { ShoppingCart, Clock, FileText, Bell, Lock } from 'lucide-react'
import { useBloqueoPIN } from '@/core/hooks/useBloqueoPIN'
import PantallaBloqueoPIN from '@/components/PantallaBloqueoPIN'

export default function CajaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario } = useAuth()
  const { tema } = useEstablecimiento()
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)

  const { bloqueado, verificado, bloquear, desbloquear, resetTimer } = useBloqueoPIN(true)

  useEffect(() => {
    if (!usuario) return
    const cargar = async () => {
      const { count } = await supabase.from('solicitudes_autorizacion')
        .select('id', { count: 'exact', head: true })
        .eq('cajero_id', usuario.id).eq('estado', 'aprobada')
      setSolicitudesPendientes(count ?? 0)
    }
    cargar()
    const canal = supabase.channel('caja-layout-notif')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_autorizacion', filter: `cajero_id=eq.${usuario.id}` }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [usuario])

  const navItems = [
    { label: 'Vender', icono: ShoppingCart, ruta: '/pos' },
    { label: 'Turno', icono: Clock, ruta: '/caja' },
    { label: 'Historial', icono: FileText, ruta: '/caja/historial' },
    { label: 'Solicitudes', icono: Bell, ruta: '/caja/solicitudes', badge: solicitudesPendientes },
  ]

  const esActivo = (ruta: string) => {
    if (ruta === '/caja') return pathname === '/caja'
    return pathname.startsWith(ruta)
  }

  if (!verificado) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <div className="flex-1 pb-20">
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map(({ label, icono: Icono, ruta, badge }) => {
            const activo = esActivo(ruta)
            return (
              <button key={ruta} onClick={() => router.push(ruta)}
                className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all relative">
                <div className={`p-1.5 rounded-xl transition-all ${activo ? 'bg-indigo-500/20' : ''}`}>
                  <Icono size={20} className={activo ? 'text-indigo-400' : 'text-zinc-500'} />
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-0.5 right-2 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[9px] font-bold text-white">{badge}</span>
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${activo ? 'text-indigo-400' : 'text-zinc-600'}`}>{label}</span>
              </button>
            )
          })}
          <button onClick={bloquear} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all">
            <div className="p-1.5 rounded-xl">
              <Lock size={20} className="text-zinc-600 hover:text-zinc-400 transition-colors" />
            </div>
            <span className="text-[10px] font-medium text-zinc-600">Bloquear</span>
          </button>
        </div>
      </nav>

      {bloqueado && (
        <PantallaBloqueoPIN
          nombreUsuario={usuario?.nombre ?? 'Cajero'}
          onDesbloqueado={() => { desbloquear(); resetTimer() }}
        />
      )}
    </div>
  )
}