'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { supabase } from '@/lib/supabase'
import { ShoppingCart, Clock, FileText, Bell, Lock, Unlock } from 'lucide-react'

const INACTIVIDAD_MS = 5 * 60 * 1000 // 5 minutos

export default function CajaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario } = useAuth()
  const { tema } = useEstablecimiento()
  const esOscuro = tema === 'oscuro'

  const [bloqueado, setBloqueado] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('caja_bloqueado') === 'true'
  })
  const [pin, setPin] = useState('')
  const [errorPin, setErrorPin] = useState<string | null>(null)
  const [validando, setValidando] = useState(false)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  const timerInactividad = useRef<NodeJS.Timeout | null>(null)

  // Badge solicitudes
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

  // Timer de inactividad
  const resetTimer = useCallback(() => {
    if (timerInactividad.current) clearTimeout(timerInactividad.current)
    timerInactividad.current = setTimeout(() => {
    sessionStorage.setItem('caja_bloqueado', 'true')
    setBloqueado(true)
  }, INACTIVIDAD_MS)
  }, [])

  useEffect(() => {
    const eventos = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll']
    eventos.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      eventos.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerInactividad.current) clearTimeout(timerInactividad.current)
    }
  }, [resetTimer])

  const validarPin = async () => {
    if (!/^[0-9]{4,6}$/.test(pin)) { setErrorPin('Ingresa tu PIN'); return }
    setValidando(true)
    setErrorPin(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('validar_pin_cajero', {
      p_usuario_id: user?.id,
      p_pin: pin,
    })
    setValidando(false)
    if (error || !data?.autorizado) {
      if (data?.sin_pin) {
        setErrorPin('No tienes PIN configurado. Pide al admin que te asigne uno.')
      } else if (data?.bloqueado_hasta) {
        const min = Math.ceil((new Date(data.bloqueado_hasta).getTime() - Date.now()) / 60000)
        setErrorPin(`Bloqueado. Intenta en ${min} min.`)
      } else {
        setErrorPin('PIN incorrecto')
      }
      setPin('')
      return
    }
    sessionStorage.removeItem('caja_bloqueado')
    setBloqueado(false)
    setPin('')
    setErrorPin(null)
    resetTimer()
  }

  const presionarTecla = (tecla: string) => {
    if (tecla === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    const nuevo = pin + tecla
    setPin(nuevo)
    if (nuevo.length >= 4) setTimeout(() => {}, 0)
  }

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

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Contenido */}
      <div className="flex-1 pb-20">
        {children}
      </div>

      {/* Navbar inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map(({ label, icono: Icono, ruta, badge }) => {
            const activo = esActivo(ruta)
            return (
              <button
                key={ruta}
                onClick={() => router.push(ruta)}
                className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all relative"
              >
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

          {/* Botón bloqueo */}
          <button
            onClick={() => { sessionStorage.setItem('caja_bloqueado', 'true'); setBloqueado(true) }}
            className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all"
          >
            <div className="p-1.5 rounded-xl">
              <Lock size={20} className="text-zinc-600 hover:text-zinc-400 transition-colors" />
            </div>
            <span className="text-[10px] font-medium text-zinc-600">Bloquear</span>
          </button>
        </div>
      </nav>

      {/* Pantalla de bloqueo */}
      {bloqueado && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xs space-y-8">
            {/* Avatar */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center">
                <Lock size={28} className="text-zinc-400" />
              </div>
              <p className="text-white font-semibold text-lg">{usuario?.nombre ?? 'Cajero'}</p>
              <p className="text-zinc-500 text-sm">Ingresa tu PIN para continuar</p>
            </div>

            {/* Puntos PIN */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pin.length || 4)).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? 'bg-indigo-400 scale-110' : 'bg-zinc-700'}`} />
              ))}
            </div>

            {errorPin && (
              <p className="text-rose-400 text-sm text-center">{errorPin}</p>
            )}

            {/* Teclado numérico */}
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

            {/* Botón desbloquear */}
            <button
              onClick={validarPin}
              disabled={pin.length < 4 || validando}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Unlock size={16} />
              {validando ? 'Verificando…' : 'Desbloquear'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}