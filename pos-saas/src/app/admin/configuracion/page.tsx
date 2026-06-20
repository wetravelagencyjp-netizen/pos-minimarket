'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface Sucursal {
  id: number
  nombre: string
  direccion: string | null
}

export default function ConfiguracionPage() {
  const { usuario } = useAuth()
  const router      = useRouter()
  const estabId     = Number(usuario?.establecimiento_id ?? 1)

  // ── Establecimiento ───────────────────────────────────────
  const [margen,          setMargen]          = useState('')
  const [nombreNegocio,   setNombreNegocio]   = useState('')
  const [guardandoEstab,  setGuardandoEstab]  = useState(false)
  const [mensajeEstab,    setMensajeEstab]    = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  // ── Alerta de caducidad ───────────────────────────────────
  const [alertaDias,      setAlertaDias]      = useState('7')
  const [alertaEstilo,    setAlertaEstilo]    = useState<'discreto' | 'llamativo'>('llamativo')
  const [guardandoAlerta, setGuardandoAlerta] = useState(false)
  const [mensajeAlerta,   setMensajeAlerta]   = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  // ── Venta sin stock ────────────────────────────────────────
  const [permiteSinStock, setPermiteSinStock]   = useState(false)
  const [guardandoStock,  setGuardandoStock]    = useState(false)

  // ── Venta sin stock ────────────────────────────────────────
  const [permiteSinStock, setPermiteSinStock]   = useState(false)
  const [guardandoStock,  setGuardandoStock]    = useState(false)

  // ── PIN de supervisor ──────────────────────────────────────
  const [pin,             setPin]             = useState('')
  const [pinConfirmar,    setPinConfirmar]    = useState('')
  const [mostrarPin,      setMostrarPin]      = useState(false)
  const [guardandoPin,    setGuardandoPin]    = useState(false)
  const [mensajePin,      setMensajePin]      = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  // ── Sucursales ────────────────────────────────────────────
  const [sucursales,      setSucursales]      = useState<Sucursal[]>([])
  const [loadingSuc,      setLoadingSuc]      = useState(true)
  const [formSuc,         setFormSuc]         = useState({ nombre: '', direccion: '' })
  const [editandoSuc,     setEditandoSuc]     = useState<number | null>(null)
  const [guardandoSuc,    setGuardandoSuc]    = useState(false)

  const cargarEstab = useCallback(async () => {
    const { data } = await supabase
      .from('establecimientos')
      .select('nombre, margen_costo_estimado, alerta_caducidad_dias, alerta_caducidad_estilo')
      .eq('id', estabId)
      .single()
    if (data) {
      setNombreNegocio(data.nombre ?? '')
      setMargen(data.margen_costo_estimado != null ? String(data.margen_costo_estimado) : '')
      setAlertaDias(String(data.alerta_caducidad_dias ?? 7))
      setAlertaEstilo((data.alerta_caducidad_estilo as 'discreto' | 'llamativo') ?? 'llamativo')
    }
    const { data: dataStock } = await supabase
      .from('establecimientos')
      .select('permite_venta_sin_stock')
      .eq('id', estabId)
      .single()
    if (dataStock) setPermiteSinStock(dataStock.permite_venta_sin_stock ?? false)
  }, [estabId])

  const cargarSucursales = useCallback(async () => {
    setLoadingSuc(true)
    const { data } = await supabase
      .from('sucursales')
      .select('id, nombre, direccion')
      .eq('establecimiento_id', estabId)
      .order('nombre')
    setSucursales(data ?? [])
    setLoadingSuc(false)
  }, [estabId])

  useEffect(() => {
    cargarEstab()
    cargarSucursales()
  }, [cargarEstab, cargarSucursales])

  const guardarEstab = async () => {
    setGuardandoEstab(true)
    setMensajeEstab(null)
    const { error } = await supabase
      .from('establecimientos')
      .update({
        nombre: nombreNegocio,
        margen_costo_estimado: parseFloat(margen) || 0,
      })
      .eq('id', estabId)
    setGuardandoEstab(false)
    setMensajeEstab(error
      ? { texto: `❌ ${error.message}`, tipo: 'error' }
      : { texto: '✅ Configuración guardada', tipo: 'ok' }
    )
  }

  const guardarAlerta = async () => {
    setGuardandoAlerta(true)
    setMensajeAlerta(null)
    const dias = parseInt(alertaDias, 10)
    const { error } = await supabase
      .from('establecimientos')
      .update({
        alerta_caducidad_dias: Number.isFinite(dias) && dias > 0 ? dias : 7,
        alerta_caducidad_estilo: alertaEstilo,
      })
      .eq('id', estabId)
    setGuardandoAlerta(false)
    setMensajeAlerta(error
      ? { texto: `❌ ${error.message}`, tipo: 'error' }
      : { texto: '✅ Configuración de alerta guardada', tipo: 'ok' }
    )
  }

  const toggleVentaSinStock = async () => {
    const nuevoValor = !permiteSinStock
    setGuardandoStock(true)
    setPermiteSinStock(nuevoValor)
    const { error } = await supabase
      .from('establecimientos')
      .update({ permite_venta_sin_stock: nuevoValor })
      .eq('id', estabId)
    setGuardandoStock(false)
    if (error) setPermiteSinStock(!nuevoValor)
  }

  const toggleVentaSinStock = async () => {
    const nuevoValor = !permiteSinStock
    setGuardandoStock(true)
    setPermiteSinStock(nuevoValor)
    const { error } = await supabase
      .from('establecimientos')
      .update({ permite_venta_sin_stock: nuevoValor })
      .eq('id', estabId)
    setGuardandoStock(false)
    if (error) setPermiteSinStock(!nuevoValor)
  }

  const guardarPin = async () => {
    setMensajePin(null)

    if (!/^[0-9]{4,6}$/.test(pin)) {
      setMensajePin({ texto: '❌ El PIN debe tener entre 4 y 6 dígitos numéricos', tipo: 'error' })
      return
    }
    if (pin !== pinConfirmar) {
      setMensajePin({ texto: '❌ Los PIN no coinciden', tipo: 'error' })
      return
    }

    setGuardandoPin(true)
    const { data, error } = await supabase.rpc('configurar_pin_supervisor', {
      p_usuario_id: usuario?.id,
      p_pin: pin,
    })
    setGuardandoPin(false)

    if (error || !data?.ok) {
      setMensajePin({ texto: `❌ ${error?.message ?? 'No se pudo guardar el PIN'}`, tipo: 'error' })
    } else {
      setMensajePin({ texto: '✅ PIN de supervisor guardado', tipo: 'ok' })
      setPin('')
      setPinConfirmar('')
    }
  }

  const guardarSucursal = async () => {
    if (!formSuc.nombre.trim()) return
    setGuardandoSuc(true)
    if (editandoSuc) {
      await supabase.from('sucursales')
        .update({ nombre: formSuc.nombre, direccion: formSuc.direccion || null })
        .eq('id', editandoSuc)
    } else {
      await supabase.from('sucursales')
        .insert({ nombre: formSuc.nombre, direccion: formSuc.direccion || null, establecimiento_id: estabId })
    }
    setGuardandoSuc(false)
    setEditandoSuc(null)
    setFormSuc({ nombre: '', direccion: '' })
    cargarSucursales()
  }

  const editarSucursal = (s: Sucursal) => {
    setEditandoSuc(s.id)
    setFormSuc({ nombre: s.nombre, direccion: s.direccion ?? '' })
  }

  const eliminarSucursal = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar la sucursal "${nombre}"? Esto afectará a los usuarios y lotes asignados a ella.`)) return
    await supabase.from('sucursales').delete().eq('id', id)
    cargarSucursales()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver al Admin
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">⚙️ Configuración del local</h1>
        </div>
        <span className="text-xs text-slate-500">{usuario?.nombre ?? 'Admin'}</span>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">

        {/* Datos del establecimiento */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">🏪 Datos del negocio</h2>
          <p className="mb-5 text-xs text-slate-500">Nombre del local y margen de ganancia por defecto para nuevos lotes.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Nombre del negocio</label>
              <input
                value={nombreNegocio}
                onChange={e => setNombreNegocio(e.target.value)}
                placeholder="Ej: Minimarket El Ahorro"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Margen de ganancia por defecto</label>
              <div className="relative">
                <input
                  type="number"
                  value={margen}
                  onChange={e => setMargen(e.target.value)}
                  placeholder="ej: 50"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              </div>
            </div>
          </div>

          {mensajeEstab && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensajeEstab.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
              {mensajeEstab.texto}
            </div>
          )}

          <button
            onClick={guardarEstab}
            disabled={guardandoEstab}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {guardandoEstab ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>

        {/* Alerta de caducidad */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">⚠️ Alerta de caducidad</h2>
          <p className="mb-5 text-xs text-slate-500">Define cuándo y cómo se avisa en el POS sobre productos próximos a vencer.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Avisar con cuántos días de anticipación</label>
              <input
                type="number"
                min={1}
                value={alertaDias}
                onChange={e => setAlertaDias(e.target.value)}
                placeholder="ej: 7"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Estilo del banner</label>
              <select
                value={alertaEstilo}
                onChange={e => setAlertaEstilo(e.target.value as 'discreto' | 'llamativo')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10">
                <option value="llamativo">Llamativo (banner ámbar)</option>
                <option value="discreto">Discreto (franja delgada)</option>
              </select>
            </div>
          </div>

          {mensajeAlerta && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensajeAlerta.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
              {mensajeAlerta.texto}
            </div>
          )}

          <button
            onClick={guardarAlerta}
            disabled={guardandoAlerta}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {guardandoAlerta ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>

        {/* Venta sin stock */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">📦 Reservas y Pedidos Especiales</h2>
          <p className="mb-5 text-xs text-slate-500">Permitir vender por encima del stock disponible (reservas / pedidos especiales).</p>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5">
            <span className="text-sm text-slate-700">Permitir ventas sin stock disponible</span>
            <button type="button" onClick={toggleVentaSinStock} disabled={guardandoStock}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${permiteSinStock ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permiteSinStock ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Venta sin stock */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">📦 Reservas y Pedidos Especiales</h2>
          <p className="mb-5 text-xs text-slate-500">Permitir vender por encima del stock disponible (reservas / pedidos especiales).</p>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5">
            <span className="text-sm text-slate-700">Permitir ventas sin stock disponible</span>
            <button type="button" onClick={toggleVentaSinStock} disabled={guardandoStock}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${permiteSinStock ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permiteSinStock ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* PIN de supervisor */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">🔒 Seguridad y Autorizaciones</h2>
          <p className="mb-5 text-xs text-slate-500">
            Define tu PIN personal de supervisor. Se usará en el POS para autorizar ventas a crédito que superen el límite del cliente. Por seguridad, una vez guardado no se puede volver a ver — solo cambiarlo.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Nuevo PIN (4 a 6 dígitos)</label>
              <div className="relative">
                <input
                  type={mostrarPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPin(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">
                  {mostrarPin ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Confirmar PIN</label>
              <input
                type={mostrarPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={pinConfirmar}
                onChange={e => setPinConfirmar(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
          </div>

          {mensajePin && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensajePin.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
              {mensajePin.texto}
            </div>
          )}

          <button
            onClick={guardarPin}
            disabled={guardandoPin}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {guardandoPin ? 'Guardando…' : 'Guardar PIN'}
          </button>
        </div>

        {/* Sucursales */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">🏬 Sucursales</h2>
          <p className="mb-5 text-xs text-slate-500">Cada sucursal puede tener su propio inventario y equipo asignado.</p>

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nombre de la sucursal *"
              value={formSuc.nombre}
              onChange={e => setFormSuc(f => ({ ...f, nombre: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
            <input
              placeholder="Dirección (opcional)"
              value={formSuc.direccion}
              onChange={e => setFormSuc(f => ({ ...f, direccion: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={guardarSucursal}
              disabled={guardandoSuc}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50">
              {guardandoSuc ? 'Guardando…' : editandoSuc ? 'Actualizar sucursal' : 'Agregar sucursal'}
            </button>
            {editandoSuc && (
              <button
                onClick={() => { setEditandoSuc(null); setFormSuc({ nombre: '', direccion: '' }) }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-50">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Lista de sucursales */}
        <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Sucursales registradas ({sucursales.length})
            </h2>
          </div>

          {loadingSuc ? (
            <div className="flex items-center justify-center p-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : sucursales.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-slate-400">
              <span className="text-3xl">🏬</span>
              <p className="text-sm">No hay sucursales registradas</p>
              <p className="text-xs">Agrega la primera para poder asignar usuarios y lotes de inventario.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Dirección</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sucursales.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-medium text-slate-900">{s.nombre}</td>
                    <td className="px-6 py-3 text-slate-500">{s.direccion ?? '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => editarSucursal(s)}
                        className="mr-3 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarSucursal(s.id, s.nombre)}
                        className="text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}