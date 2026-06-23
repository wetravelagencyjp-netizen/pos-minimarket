'use client'

import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { getModulo } from '@/modules/_registry'
import { useCarrito } from '@/core/context/CarritoContext'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ShoppingCart, Clock, FileText, Bell, Lock, Unlock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CheckoutModal from './CheckoutModal'
import type { SlotProps } from '@/core/types/modulos.types'

type Tema = 'claro' | 'oscuro'

// ─── Slot genérico: Barra superior ────────────────────────────
function TopBarDefault({ establecimiento }: SlotProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <input
        type="text"
        placeholder="Buscar producto o escanear código..."
        className="flex-1 bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      />
      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">
        {establecimiento.nombre}
      </span>
    </div>
  )
}

// ─── Slot genérico: Catálogo de productos ─────────────────────
function CatalogoDefault({ establecimiento, sucursalId }: SlotProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all duration-200"
          >
            <div className="w-full aspect-square bg-slate-700 rounded-lg mb-3 flex items-center justify-center text-3xl">
              📦
            </div>
            <div className="h-3 bg-slate-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slot genérico: Panel de carrito ──────────────────────────
function CarritoDefault(_props: SlotProps) {
  const { items, total, cambiarCantidad, quitarItem } = useCarrito()
  const { tema, cambiarTema } = useEstablecimiento()
  const [mostrarCheckout, setMostrarCheckout] = useState(false)
  const router = useRouter()
  const esOscuro = tema === 'oscuro'

  const c = {
    fondo: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200',
    header: esOscuro ? 'border-zinc-800' : 'border-slate-200',
    titulo: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    btnNav: esOscuro ? 'text-zinc-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600',
    itemFondo: esOscuro ? 'bg-zinc-800/60' : 'bg-slate-50 border border-slate-200',
    itemNombre: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    itemQuitar: esOscuro ? 'text-zinc-600 hover:text-rose-400' : 'text-slate-300 hover:text-rose-500',
    btnCantidad: esOscuro ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100' : 'bg-slate-200 hover:bg-slate-300 text-slate-700',
    cantidadText: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    precio: 'text-indigo-500 font-semibold',
    footerBorder: esOscuro ? 'border-zinc-800' : 'border-slate-200',
    totalLabel: esOscuro ? 'text-zinc-400' : 'text-slate-500',
    totalMonto: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    btnDisabled: esOscuro ? 'disabled:bg-zinc-800 disabled:text-zinc-600' : 'disabled:bg-slate-100 disabled:text-slate-400',
    vacio: esOscuro ? 'text-zinc-400' : 'text-slate-400',
    vacioSub: esOscuro ? 'text-zinc-500' : 'text-slate-400',
    iconoVacio: esOscuro ? 'bg-zinc-800' : 'bg-slate-100',
  }

  const ToggleTema = (
    <button
      onClick={() => cambiarTema(esOscuro ? 'claro' : 'oscuro')}
      title="Cambiar tema"
      className={`text-xs px-2 py-1 rounded-lg transition-colors ${esOscuro ? 'text-zinc-500 hover:text-zinc-200' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {esOscuro ? '☀️' : '🌙'}
    </button>
  )

  const Header = (
    <div className={`px-4 py-3 border-b ${c.header} flex items-center justify-between gap-2`}>
      <h2 className={`${c.titulo} font-semibold text-sm tracking-wide`}>Venta actual</h2>
      <div className="flex items-center gap-1">
        {_props.usuario.rol === 'admin' && (
          <button onClick={() => router.push('/admin')} className={`${c.btnNav} text-xs transition-colors px-1.5 py-1 rounded-lg`}>
            ⚙️ Admin
          </button>
        )}
        {(_props.usuario as any).es_superadmin && (
          <button onClick={() => router.push('/superadmin')} className={`text-xs px-1.5 py-1 rounded-lg transition-colors ${esOscuro ? 'text-zinc-500 hover:text-amber-400' : 'text-slate-400 hover:text-amber-600'}`}>
            ⚡ Super
          </button>
        )}
        <button onClick={() => router.push('/caja')} className={`${c.btnNav} text-xs transition-colors px-1.5 py-1 rounded-lg`}>
          💰 Caja
        </button>
        {ToggleTema}
      </div>
    </div>
  )

  if (items.length === 0) {
    return (
      <div className={`w-80 flex flex-col ${c.fondo} border-l h-full`}>
        {Header}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`w-12 h-12 ${c.iconoVacio} rounded-full mx-auto mb-3 flex items-center justify-center`}>
              <span className="text-2xl">🛒</span>
            </div>
            <p className={`${c.vacio} text-sm`}>Carrito vacío</p>
            <p className={`${c.vacioSub} text-xs mt-1`}>Selecciona un producto para comenzar</p>
          </div>
        </div>
        <div className={`p-4 border-t ${c.footerBorder} space-y-3`}>
          <div className="flex justify-between items-center">
            <span className={`${c.totalLabel} text-sm`}>Total</span>
            <span className={`${c.totalMonto} font-bold text-xl`}>$0.00</span>
          </div>
          <button disabled className={`w-full bg-indigo-600 ${c.btnDisabled} text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide`}>
            Cobrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-80 flex flex-col ${c.fondo} border-l h-full`}>
      {Header}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.map((item) => (
          <div key={item.productoId} className={`${c.itemFondo} rounded-xl p-3`}>
            <div className="flex justify-between items-start gap-2">
              <p className={`${c.itemNombre} text-sm font-medium flex-1 flex items-center gap-1.5`}>
                {item.nombre}
                {item.esReserva && (
                  <span className="bg-amber-500/15 text-amber-400 text-[10px] font-semibold px-1.5 py-0.5 rounded">Reserva</span>
                )}
              </p>
              <button onClick={() => quitarItem(item.productoId)} className={`${c.itemQuitar} text-xs transition-colors`}>
                ✕
              </button>
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
                  className={`w-6 h-6 rounded-lg ${c.btnCantidad} text-sm transition-colors`}
                >
                  −
                </button>
                <span className={`${c.cantidadText} text-sm w-6 text-center`}>{item.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1, _props.establecimiento.permite_venta_sin_stock)}
                  disabled={item.cantidad >= item.stockDisponible && !_props.establecimiento.permite_venta_sin_stock}
                  className={`w-6 h-6 rounded-lg ${c.btnCantidad} disabled:opacity-40 text-sm transition-colors`}
                >
                  +
                </button>
              </div>
              <span className={`${c.precio} text-sm`}>
                ${(item.precioUnitario * item.cantidad).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={`p-4 border-t ${c.footerBorder} space-y-3`}>
        <div className="flex justify-between items-center">
          <span className={`${c.totalLabel} text-sm`}>Total</span>
          <span className={`${c.totalMonto} font-bold text-xl`}>${total.toFixed(2)}</span>
        </div>
        <button
          onClick={() => setMostrarCheckout(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide"
        >
          Cobrar
        </button>
        {mostrarCheckout && (
          <CheckoutModal
            establecimientoId={_props.establecimiento.id}
            onClose={() => setMostrarCheckout(false)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Skeleton Loader ───────────────────────────────────────────
function PosSkeletonLoader() {
  return (
    <div className="flex flex-col h-screen bg-slate-900 animate-pulse">
      <div className="h-12 bg-slate-800 border-b border-slate-700" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-4 grid grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl aspect-square" />
          ))}
        </div>
        <div className="w-80 bg-slate-800 border-l border-slate-700" />
      </div>
    </div>
  )
}

// ─── PosShell: Orquestador principal ──────────────────────────
export function PosShell() {
  const { establecimiento, usuario, sucursalId, isLoading, error, tema } = useEstablecimiento()
  const router = useRouter()

  if (isLoading) return <PosSkeletonLoader />

  if (error || !establecimiento || !usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">
            {error ?? 'No se pudo cargar la sesión'}
          </p>
          <a href="/login" className="inline-block text-indigo-400 hover:text-indigo-300 text-sm underline transition-colors">
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  const modulo = getModulo(establecimiento.business_type)
  const slotProps: SlotProps = { establecimiento, usuario, sucursalId }
  const esOscuro = tema === 'oscuro'

  const TopBar   = modulo.topBarSlot   ?? TopBarDefault
  const Catalogo = modulo.catalogoSlot ?? CatalogoDefault
  const Carrito  = modulo.carritoSlot  ?? CarritoDefault

  const esCajero = usuario.rol !== 'admin' && !(usuario as any).es_superadmin
  const [bloqueado, setBloqueado] = useState(false)
  const [verificadoBloqueo, setVerificadoBloqueo] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('caja_bloqueado') === 'true') {
      setBloqueado(true)
    }
    setVerificadoBloqueo(true)
  }, [])
  const [pin, setPin] = useState('')
  const [errorPin, setErrorPin] = useState<string | null>(null)
  const [validando, setValidando] = useState(false)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!esCajero) return
    const cargar = async () => {
      const { count } = await supabase.from('solicitudes_autorizacion')
        .select('id', { count: 'exact', head: true })
        .eq('cajero_id', usuario.id).eq('estado', 'aprobada')
      setSolicitudesPendientes(count ?? 0)
    }
    cargar()
    const canal = supabase.channel('pos-shell-notif')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_autorizacion', filter: `cajero_id=eq.${usuario.id}` }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [esCajero, usuario.id])

  useEffect(() => {
    if (!esCajero) return
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
    sessionStorage.setItem('caja_bloqueado', 'true')
    setBloqueado(true)
  }, 5 * 60 * 1000)
    }
    const eventos = ['mousedown', 'keydown', 'touchstart']
    eventos.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => {
      eventos.forEach(e => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [esCajero])

  const validarPin = async () => {
    if (!/^[0-9]{4,6}$/.test(pin)) { setErrorPin('Ingresa tu PIN'); return }
    setValidando(true)
    setErrorPin(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('validar_pin_cajero', { p_usuario_id: user?.id, p_pin: pin })
    setValidando(false)
    if (error || !data?.autorizado) {
      if (data?.sin_pin) setErrorPin('Sin PIN configurado. Pide al admin.')
      else if (data?.bloqueado_hasta) {
        const min = Math.ceil((new Date(data.bloqueado_hasta).getTime() - Date.now()) / 60000)
        setErrorPin(`Bloqueado ${min} min.`)
      } else setErrorPin('PIN incorrecto')
      setPin('')
      return
    }
    sessionStorage.removeItem('caja_bloqueado')
    setBloqueado(false)
    setPin('')
    setErrorPin(null)
  }

  const navItems = [
    { label: 'Vender', icono: ShoppingCart, ruta: '/pos' },
    { label: 'Turno', icono: Clock, ruta: '/caja' },
    { label: 'Historial', icono: FileText, ruta: '/caja/historial' },
    { label: 'Solicitudes', icono: Bell, ruta: '/caja/solicitudes', badge: solicitudesPendientes },
  ]

  if (esCajero && !verificadoBloqueo) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
    </div>
  )

  return (
    <div className={`flex flex-col overflow-hidden ${esOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'} ${esCajero ? 'h-screen' : 'h-screen'}`}>
      {modulo.alertaSlot && <modulo.alertaSlot {...slotProps} />}
      <TopBar {...slotProps} />
      <div className={`flex flex-1 overflow-hidden ${esCajero ? 'pb-16' : ''}`}>
        <Catalogo {...slotProps} />
        <Carrito {...slotProps} />
      </div>

      {/* Navbar cajero */}
      {esCajero && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800">
          <div className="flex items-center justify-around px-2 py-2 max-w-2xl mx-auto">
            {navItems.map(({ label, icono: Icono, ruta, badge }) => {
              const activo = ruta === '/pos'
              return (
                <button key={ruta} onClick={() => router.push(ruta)}
                  className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all relative">
                  <div className={`p-1.5 rounded-xl ${activo ? 'bg-indigo-500/20' : ''}`}>
                    <Icono size={18} className={activo ? 'text-indigo-400' : 'text-zinc-500'} />
                    {badge != null && badge > 0 && (
                      <span className="absolute top-0 right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[9px] font-bold text-white">{badge}</span>
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${activo ? 'text-indigo-400' : 'text-zinc-600'}`}>{label}</span>
                </button>
              )
            })}
            <button onClick={() => { sessionStorage.setItem('caja_bloqueado', 'true'); setBloqueado(true) }}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all">
              <div className="p-1.5 rounded-xl">
                <Lock size={18} className="text-zinc-600 hover:text-zinc-400 transition-colors" />
              </div>
              <span className="text-[10px] font-medium text-zinc-600">Bloquear</span>
            </button>
          </div>
        </nav>
      )}

      {/* Pantalla de bloqueo */}
      {bloqueado && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xs space-y-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center">
                <Lock size={28} className="text-zinc-400" />
              </div>
              <p className="text-white font-semibold text-lg">{usuario?.nombre ?? 'Cajero'}</p>
              <p className="text-zinc-500 text-sm">Ingresa tu PIN para continuar</p>
            </div>
            <div className="flex justify-center gap-4">
              {[0,1,2,3].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? 'bg-indigo-400 scale-110' : 'bg-zinc-700'}`} />
              ))}
            </div>
            {errorPin && <p className="text-rose-400 text-sm text-center">{errorPin}</p>}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((tecla, i) => (
                <button key={i} onClick={() => {
                  if (!tecla) return
                  if (tecla === '⌫') { setPin(p => p.slice(0, -1)); return }
                  if (pin.length < 6) setPin(p => p + tecla)
                }}
                  disabled={!tecla}
                  className={`h-14 rounded-2xl text-xl font-semibold transition-all ${
                    tecla === '⌫' ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95'
                    : tecla ? 'bg-zinc-800 text-white hover:bg-zinc-700 active:scale-95'
                    : 'opacity-0 pointer-events-none'
                  }`}>
                  {tecla}
                </button>
              ))}
            </div>
            <button onClick={validarPin} disabled={pin.length < 4 || validando}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
              <Unlock size={16} />
              {validando ? 'Verificando…' : 'Desbloquear'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}