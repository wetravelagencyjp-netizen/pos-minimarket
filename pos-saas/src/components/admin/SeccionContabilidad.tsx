'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Cuenta {
  id: number
  nombre: string
  tipo: 'efectivo' | 'banco' | 'billetera_digital' | 'otro'
  saldo_inicial: number
  saldo_actual: number
  activo: boolean
}

interface CategoriaEgreso {
  id: number
  nombre: string
  tipo: 'fijo' | 'variable'
  icono: string
}

interface SubcategoriaEgreso {
  id: number
  categoria_id: number
  nombre: string
}

interface Egreso {
  id: number
  descripcion: string
  monto: number
  fecha: string
  es_recurrente: boolean
  notas: string | null
  cuenta_id: number | null
  categoria_id: number | null
  subcategoria_id: number | null
  categoria?: { nombre: string; icono: string }
  subcategoria?: { nombre: string }
  cuenta?: { nombre: string }
}

interface Transferencia {
  id: number
  monto: number
  descripcion: string | null
  fecha: string
  cuenta_origen: { nombre: string }
  cuenta_destino: { nombre: string }
}

const TIPO_CUENTA_LABEL: Record<string, string> = {
  efectivo: '💵 Efectivo',
  banco: '🏦 Banco',
  billetera_digital: '📱 Billetera Digital',
  otro: '💼 Otro',
}

const TIPO_CUENTA_COLOR: Record<string, string> = {
  efectivo: 'text-emerald-400',
  banco: 'text-blue-400',
  billetera_digital: 'text-violet-400',
  otro: 'text-zinc-400',
}

export default function SeccionContabilidad({ establecimientoId }: { establecimientoId: number }) {
  const [tab, setTab] = useState<'resumen' | 'cuentas' | 'egresos' | 'transferencias' | 'balance'>('resumen')
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [categorias, setCategorias] = useState<CategoriaEgreso[]>([])
  const [subcategorias, setSubcategorias] = useState<SubcategoriaEgreso[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [ingresosPorMes, setIngresosPorMes] = useState<{ mes: string; total: number }[]>([])
  const [egresosPorMes, setEgresosPorMes] = useState<{ mes: string; total: number }[]>([])
  const [cargando, setCargando] = useState(true)

  // Forms
  const [formCuenta, setFormCuenta] = useState({ nombre: '', tipo: 'efectivo', saldo_inicial: '' })
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)
  const [formCategoria, setFormCategoria] = useState({ nombre: '', tipo: 'variable', icono: '💸' })
  const [guardandoCategoria, setGuardandoCategoria] = useState(false)
  const [formSubcategoria, setFormSubcategoria] = useState({ nombre: '', categoria_id: '' })
  const [guardandoSubcat, setGuardandoSubcat] = useState(false)
  const [formEgreso, setFormEgreso] = useState({
    descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10),
    cuenta_id: '', categoria_id: '', subcategoria_id: '', es_recurrente: false, notas: '',
  })
  const [guardandoEgreso, setGuardandoEgreso] = useState(false)
  const [mensajeEgreso, setMensajeEgreso] = useState<string | null>(null)
  const [formTransferencia, setFormTransferencia] = useState({
    origen_id: '', destino_id: '', monto: '',
    descripcion: '', fecha: new Date().toISOString().slice(0, 10),
  })
  const [guardandoTransferencia, setGuardandoTransferencia] = useState(false)
  const [mensajeTransferencia, setMensajeTransferencia] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [
      { data: c }, { data: cat }, { data: subcat }, { data: eg },
      { data: transf }, { data: ventas }, { data: egAdmin }
    ] = await Promise.all([
      supabase.from('cuentas_financieras').select('*').eq('establecimiento_id', establecimientoId).eq('activo', true).order('nombre'),
      supabase.from('categorias_egreso').select('*').eq('establecimiento_id', establecimientoId).order('nombre'),
      supabase.from('subcategorias_egreso').select('*').eq('establecimiento_id', establecimientoId).order('nombre'),
      supabase.from('egresos_administrador')
        .select('*, categoria:categorias_egreso(nombre, icono), subcategoria:subcategorias_egreso(nombre), cuenta:cuentas_financieras(nombre)')
        .eq('establecimiento_id', establecimientoId).order('fecha', { ascending: false }).limit(50),
      supabase.from('transferencias_internas')
        .select('*, cuenta_origen:cuentas_financieras!transferencias_internas_cuenta_origen_id_fkey(nombre), cuenta_destino:cuentas_financieras!transferencias_internas_cuenta_destino_id_fkey(nombre)')
        .eq('establecimiento_id', establecimientoId).order('fecha', { ascending: false }).limit(30),
      supabase.from('ventas').select('total, fecha_venta').eq('establecimiento_id', establecimientoId)
        .gte('fecha_venta', new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString()),
      supabase.from('egresos_administrador').select('monto, fecha').eq('establecimiento_id', establecimientoId),
    ])

    setCuentas(c ?? [])
    setCategorias(cat ?? [])
    setSubcategorias(subcat ?? [])
    setEgresos(eg ?? [])
    setTransferencias(transf ?? [])

    const porMesIngreso: Record<string, number> = {}
    for (const v of ventas ?? []) {
      const mes = new Date(v.fecha_venta).toLocaleDateString('es-EC', { month: 'short', year: '2-digit' })
      porMesIngreso[mes] = (porMesIngreso[mes] ?? 0) + Number(v.total)
    }
    setIngresosPorMes(Object.entries(porMesIngreso).map(([mes, total]) => ({ mes, total })))

    const porMesEgreso: Record<string, number> = {}
    for (const e of egAdmin ?? []) {
      const mes = new Date(e.fecha).toLocaleDateString('es-EC', { month: 'short', year: '2-digit' })
      porMesEgreso[mes] = (porMesEgreso[mes] ?? 0) + Number(e.monto)
    }
    setEgresosPorMes(Object.entries(porMesEgreso).map(([mes, total]) => ({ mes, total })))

    setCargando(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  // Subcategorías filtradas por categoría seleccionada
  const subcatFiltradas = subcategorias.filter(
    s => s.categoria_id === parseInt(formEgreso.categoria_id)
  )

  const guardarCuenta = async () => {
    if (!formCuenta.nombre) return
    setGuardandoCuenta(true)
    const saldo = parseFloat(formCuenta.saldo_inicial) || 0
    await supabase.from('cuentas_financieras').insert({
      establecimiento_id: establecimientoId,
      nombre: formCuenta.nombre,
      tipo: formCuenta.tipo,
      saldo_inicial: saldo,
      saldo_actual: saldo,
    })
    setFormCuenta({ nombre: '', tipo: 'efectivo', saldo_inicial: '' })
    setGuardandoCuenta(false)
    cargar()
  }

  const guardarCategoria = async () => {
    if (!formCategoria.nombre) return
    setGuardandoCategoria(true)
    await supabase.from('categorias_egreso').insert({
      establecimiento_id: establecimientoId,
      nombre: formCategoria.nombre,
      tipo: formCategoria.tipo,
      icono: formCategoria.icono,
    })
    setFormCategoria({ nombre: '', tipo: 'variable', icono: '💸' })
    setGuardandoCategoria(false)
    cargar()
  }

  const guardarSubcategoria = async () => {
    if (!formSubcategoria.nombre || !formSubcategoria.categoria_id) return
    setGuardandoSubcat(true)
    await supabase.from('subcategorias_egreso').insert({
      establecimiento_id: establecimientoId,
      categoria_id: parseInt(formSubcategoria.categoria_id),
      nombre: formSubcategoria.nombre,
    })
    setFormSubcategoria({ nombre: '', categoria_id: '' })
    setGuardandoSubcat(false)
    cargar()
  }

  const guardarEgreso = async () => {
    if (!formEgreso.descripcion || !formEgreso.monto) return
    setGuardandoEgreso(true)
    setMensajeEgreso(null)
    const { error } = await supabase.rpc('registrar_egreso_admin', {
      p_establecimiento_id: establecimientoId,
      p_cuenta_id: formEgreso.cuenta_id ? parseInt(formEgreso.cuenta_id) : null,
      p_categoria_id: formEgreso.categoria_id ? parseInt(formEgreso.categoria_id) : null,
      p_subcategoria_id: formEgreso.subcategoria_id ? parseInt(formEgreso.subcategoria_id) : null,
      p_descripcion: formEgreso.descripcion,
      p_monto: parseFloat(formEgreso.monto),
      p_fecha: formEgreso.fecha,
      p_es_recurrente: formEgreso.es_recurrente,
      p_notas: formEgreso.notas || null,
    })
    setGuardandoEgreso(false)
    if (!error) {
      setMensajeEgreso('✅ Egreso registrado y saldo actualizado')
      setFormEgreso({ descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10), cuenta_id: '', categoria_id: '', subcategoria_id: '', es_recurrente: false, notas: '' })
      cargar()
    } else {
      setMensajeEgreso(`❌ ${error.message}`)
    }
  }

  const guardarTransferencia = async () => {
    if (!formTransferencia.origen_id || !formTransferencia.destino_id || !formTransferencia.monto) return
    if (formTransferencia.origen_id === formTransferencia.destino_id) {
      setMensajeTransferencia('❌ Origen y destino no pueden ser la misma cuenta')
      return
    }
    setGuardandoTransferencia(true)
    setMensajeTransferencia(null)
    const { error } = await supabase.rpc('transferencia_interna', {
      p_establecimiento_id: establecimientoId,
      p_origen_id: parseInt(formTransferencia.origen_id),
      p_destino_id: parseInt(formTransferencia.destino_id),
      p_monto: parseFloat(formTransferencia.monto),
      p_descripcion: formTransferencia.descripcion || null,
      p_fecha: formTransferencia.fecha,
    })
    setGuardandoTransferencia(false)
    if (!error) {
      setMensajeTransferencia('✅ Transferencia realizada')
      setFormTransferencia({ origen_id: '', destino_id: '', monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) })
      cargar()
    } else {
      setMensajeTransferencia(`❌ ${error.message}`)
    }
  }

  const eliminarEgreso = async (id: number) => {
    if (!confirm('¿Eliminar este egreso?')) return
    await supabase.from('egresos_administrador').delete().eq('id', id)
    cargar()
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`
  const totalSaldoActual = cuentas.reduce((s, c) => s + Number(c.saldo_actual), 0)
  const totalEgresos = egresos.reduce((s, e) => s + Number(e.monto), 0)

  const mesesUnicos = Array.from(new Set([
    ...ingresosPorMes.map(i => i.mes),
    ...egresosPorMes.map(e => e.mes),
  ]))
  const mapaIngresos = new Map(ingresosPorMes.map(i => [i.mes, i.total]))
  const mapaEgresos = new Map(egresosPorMes.map(e => [e.mes, e.total]))

  const Tab = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
        tab === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  )

  const inputCls = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'
  const btnPrimary = 'rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors'

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-zinc-800/50 rounded-2xl p-1 w-fit flex-wrap">
        <Tab id="resumen" label="📊 Resumen" />
        <Tab id="cuentas" label="💰 Cuentas" />
        <Tab id="egresos" label="💸 Egresos" />
        <Tab id="transferencias" label="🔄 Transferencias" />
        <Tab id="balance" label="📈 Balance" />
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Saldo total actual', valor: fmt(totalSaldoActual), icono: '🏦', color: 'text-emerald-400' },
              { label: 'Total egresos', valor: fmt(totalEgresos), icono: '💸', color: 'text-rose-400' },
              { label: 'Flujo neto estimado', valor: fmt(totalSaldoActual - totalEgresos), icono: '📊', color: totalSaldoActual - totalEgresos >= 0 ? 'text-emerald-400' : 'text-rose-400' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
                <p className="text-2xl mb-3">{kpi.icono}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.valor}</p>
                <p className="text-xs text-zinc-500 mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">💳 Saldos actuales por cuenta</h2>
            {cuentas.length === 0 ? (
              <p className="text-xs text-zinc-500">No hay cuentas — agrégalas en la pestaña Cuentas.</p>
            ) : (
              <>
                {cuentas.map(c => (
                  <div key={c.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                    <div>
                      <p className="text-sm text-zinc-200">{c.nombre}</p>
                      <p className={`text-xs ${TIPO_CUENTA_COLOR[c.tipo]}`}>{TIPO_CUENTA_LABEL[c.tipo]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{fmt(Number(c.saldo_actual))}</p>
                      {Number(c.saldo_actual) !== Number(c.saldo_inicial) && (
                        <p className="text-[10px] text-zinc-600">Inicial: {fmt(Number(c.saldo_inicial))}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total consolidado</span>
                  <span className="text-sm font-bold text-emerald-400">{fmt(totalSaldoActual)}</span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">🕐 Últimos egresos</h2>
            {egresos.slice(0, 5).length === 0 ? (
              <p className="text-xs text-zinc-500">Sin egresos registrados.</p>
            ) : (
              egresos.slice(0, 5).map(e => (
                <div key={e.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm text-zinc-200">{e.descripcion}</p>
                    <p className="text-xs text-zinc-500">
                      {(e.categoria as any)?.icono} {(e.categoria as any)?.nombre ?? '—'}
                      {(e.subcategoria as any)?.nombre && ` › ${(e.subcategoria as any).nombre}`}
                      {' · '}{new Date(e.fecha).toLocaleDateString('es-EC')}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-rose-400">-{fmt(Number(e.monto))}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── CUENTAS ── */}
      {tab === 'cuentas' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">➕ Nueva cuenta</h2>
            <div className="grid grid-cols-3 gap-3">
              <input placeholder="Nombre (ej: Banco Pichincha)" value={formCuenta.nombre}
                onChange={e => setFormCuenta(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
              <select value={formCuenta.tipo} onChange={e => setFormCuenta(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                <option value="efectivo">💵 Efectivo</option>
                <option value="banco">🏦 Banco</option>
                <option value="billetera_digital">📱 Billetera Digital</option>
                <option value="otro">💼 Otro</option>
              </select>
              <input type="number" placeholder="Saldo inicial" value={formCuenta.saldo_inicial}
                onChange={e => setFormCuenta(f => ({ ...f, saldo_inicial: e.target.value }))} className={inputCls} />
            </div>
            <button onClick={guardarCuenta} disabled={guardandoCuenta} className={btnPrimary}>
              {guardandoCuenta ? 'Guardando…' : 'Agregar cuenta'}
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Cuentas ({cuentas.length})</h2>
            </div>
            {cuentas.length === 0 ? <p className="p-5 text-xs text-zinc-500">Sin cuentas aún.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Cuenta</th>
                    <th className="px-5 py-3 text-left">Tipo</th>
                    <th className="px-5 py-3 text-right">Saldo inicial</th>
                    <th className="px-5 py-3 text-right">Saldo actual</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map(c => (
                    <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-zinc-200 font-medium">{c.nombre}</td>
                      <td className={`px-5 py-3 text-xs ${TIPO_CUENTA_COLOR[c.tipo]}`}>{TIPO_CUENTA_LABEL[c.tipo]}</td>
                      <td className="px-5 py-3 text-right text-zinc-500">{fmt(Number(c.saldo_inicial))}</td>
                      <td className="px-5 py-3 text-right text-white font-bold">{fmt(Number(c.saldo_actual))}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-800/30">
                    <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total consolidado</td>
                    <td className="px-5 py-3 text-right text-emerald-400 font-bold">{fmt(totalSaldoActual)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Categorías y subcategorías */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white">🏷️ Categorías de egreso</h2>
            <div className="grid grid-cols-3 gap-3">
              <input placeholder="Nombre (ej: Nómina)" value={formCategoria.nombre}
                onChange={e => setFormCategoria(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
              <select value={formCategoria.tipo} onChange={e => setFormCategoria(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                <option value="fijo">📌 Fijo (mensual)</option>
                <option value="variable">🔄 Variable</option>
              </select>
              <input placeholder="Emoji" value={formCategoria.icono}
                onChange={e => setFormCategoria(f => ({ ...f, icono: e.target.value }))} className={inputCls} />
            </div>
            <button onClick={guardarCategoria} disabled={guardandoCategoria} className={btnPrimary}>
              {guardandoCategoria ? 'Guardando…' : 'Agregar categoría'}
            </button>
            <div className="flex flex-wrap gap-2">
              {categorias.map(c => (
                <span key={c.id} className={`rounded-full px-3 py-1 text-xs font-medium ${c.tipo === 'fijo' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {c.icono} {c.nombre}
                </span>
              ))}
            </div>

            </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">🔖 Subcategorías</h2>
              <div className="grid grid-cols-2 gap-3">
                <select value={formSubcategoria.categoria_id}
                  onChange={e => setFormSubcategoria(f => ({ ...f, categoria_id: e.target.value }))} className={inputCls}>
                  <option value="">— Categoría padre —</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                </select>
                <input placeholder="Nombre subcategoría (ej: Marketing)" value={formSubcategoria.nombre}
                  onChange={e => setFormSubcategoria(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
              </div>
              <button onClick={guardarSubcategoria} disabled={guardandoSubcat} className={btnPrimary}>
                {guardandoSubcat ? 'Guardando…' : 'Agregar subcategoría'}
              </button>
              <div className="space-y-1">
                {categorias.map(cat => {
                  const subs = subcategorias.filter(s => s.categoria_id === cat.id)
                  if (subs.length === 0) return null
                  return (
                    <div key={cat.id} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-500">{cat.icono} {cat.nombre} →</span>
                      {subs.map(s => (
                        <span key={s.id} className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300">
                          {s.nombre}
                        </span>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
        </div>
      )}

      {/* ── EGRESOS ── */}
      {tab === 'egresos' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">➕ Registrar egreso</h2>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Descripción *" value={formEgreso.descripcion}
                onChange={e => setFormEgreso(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
              <input type="number" placeholder="Monto *" value={formEgreso.monto}
                onChange={e => setFormEgreso(f => ({ ...f, monto: e.target.value }))} className={inputCls} />
              <input type="date" value={formEgreso.fecha}
                onChange={e => setFormEgreso(f => ({ ...f, fecha: e.target.value }))} className={inputCls} />
              <select value={formEgreso.cuenta_id}
                onChange={e => setFormEgreso(f => ({ ...f, cuenta_id: e.target.value }))} className={inputCls}>
                <option value="">— Cuenta de salida —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(Number(c.saldo_actual))})</option>)}
              </select>
              <select value={formEgreso.categoria_id}
                onChange={e => setFormEgreso(f => ({ ...f, categoria_id: e.target.value, subcategoria_id: '' }))} className={inputCls}>
                <option value="">— Categoría —</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
              </select>
              <select value={formEgreso.subcategoria_id}
                onChange={e => setFormEgreso(f => ({ ...f, subcategoria_id: e.target.value }))}
                disabled={!formEgreso.categoria_id || subcatFiltradas.length === 0}
                className={inputCls}>
                <option value="">— Subcategoría —</option>
                {subcatFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <input placeholder="Notas opcionales" value={formEgreso.notas}
                onChange={e => setFormEgreso(f => ({ ...f, notas: e.target.value }))} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={formEgreso.es_recurrente}
                onChange={e => setFormEgreso(f => ({ ...f, es_recurrente: e.target.checked }))}
                className="rounded border-zinc-600" />
              Es un gasto recurrente (fijo mensual)
            </label>
            {mensajeEgreso && <p className={`text-xs ${mensajeEgreso.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>{mensajeEgreso}</p>}
            <button onClick={guardarEgreso} disabled={guardandoEgreso} className={btnPrimary}>
              {guardandoEgreso ? 'Guardando…' : 'Registrar egreso'}
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Historial ({egresos.length})</h2>
            </div>
            {egresos.length === 0 ? <p className="p-5 text-xs text-zinc-500">Sin egresos.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Descripción</th>
                    <th className="px-5 py-3 text-left">Categoría</th>
                    <th className="px-5 py-3 text-left">Cuenta</th>
                    <th className="px-5 py-3 text-left">Fecha</th>
                    <th className="px-5 py-3 text-right">Monto</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {egresos.map(e => (
                    <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-zinc-200">
                        {e.descripcion}
                        {e.es_recurrente && <span className="ml-1.5 text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full">Fijo</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-400">
                        {(e.categoria as any)?.icono} {(e.categoria as any)?.nombre ?? '—'}
                        {(e.subcategoria as any)?.nombre && (
                          <span className="text-zinc-600"> › {(e.subcategoria as any).nombre}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-400">{(e.cuenta as any)?.nombre ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{new Date(e.fecha).toLocaleDateString('es-EC')}</td>
                      <td className="px-5 py-3 text-right font-medium text-rose-400">-{fmt(Number(e.monto))}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => eliminarEgreso(e.id)} className="text-xs text-zinc-600 hover:text-rose-400 transition-colors">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TRANSFERENCIAS ── */}
      {tab === 'transferencias' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">🔄 Nueva transferencia interna</h2>
            <p className="text-xs text-zinc-500">Mueve dinero entre tus cuentas sin afectar el balance de pérdidas y ganancias.</p>
            <div className="grid grid-cols-2 gap-3">
              <select value={formTransferencia.origen_id}
                onChange={e => setFormTransferencia(f => ({ ...f, origen_id: e.target.value }))} className={inputCls}>
                <option value="">— Cuenta origen —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(Number(c.saldo_actual))})</option>)}
              </select>
              <select value={formTransferencia.destino_id}
                onChange={e => setFormTransferencia(f => ({ ...f, destino_id: e.target.value }))} className={inputCls}>
                <option value="">— Cuenta destino —</option>
                {cuentas.filter(c => String(c.id) !== formTransferencia.origen_id).map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({fmt(Number(c.saldo_actual))})</option>
                ))}
              </select>
              <input type="number" placeholder="Monto *" value={formTransferencia.monto}
                onChange={e => setFormTransferencia(f => ({ ...f, monto: e.target.value }))} className={inputCls} />
              <input type="date" value={formTransferencia.fecha}
                onChange={e => setFormTransferencia(f => ({ ...f, fecha: e.target.value }))} className={inputCls} />
              <input placeholder="Descripción (opcional)" value={formTransferencia.descripcion}
                onChange={e => setFormTransferencia(f => ({ ...f, descripcion: e.target.value }))}
                className={`${inputCls} col-span-2`} />
            </div>
            {mensajeTransferencia && (
              <p className={`text-xs ${mensajeTransferencia.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {mensajeTransferencia}
              </p>
            )}
            <button onClick={guardarTransferencia} disabled={guardandoTransferencia} className={btnPrimary}>
              {guardandoTransferencia ? 'Procesando…' : 'Realizar transferencia'}
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Historial de transferencias ({transferencias.length})</h2>
            </div>
            {transferencias.length === 0 ? <p className="p-5 text-xs text-zinc-500">Sin transferencias aún.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Origen</th>
                    <th className="px-5 py-3 text-left">Destino</th>
                    <th className="px-5 py-3 text-left">Descripción</th>
                    <th className="px-5 py-3 text-left">Fecha</th>
                    <th className="px-5 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {transferencias.map(t => (
                    <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-zinc-300">{(t.cuenta_origen as any)?.nombre}</td>
                      <td className="px-5 py-3 text-zinc-300">{(t.cuenta_destino as any)?.nombre}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{t.descripcion ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{new Date(t.fecha).toLocaleDateString('es-EC')}</td>
                      <td className="px-5 py-3 text-right font-medium text-violet-400">{fmt(Number(t.monto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── BALANCE ── */}
      {tab === 'balance' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">📈 Ingresos vs Egresos por mes</h2>
            </div>
            {mesesUnicos.length === 0 ? <p className="p-5 text-xs text-zinc-500">Sin datos suficientes.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Mes</th>
                    <th className="px-5 py-3 text-right">Ingresos</th>
                    <th className="px-5 py-3 text-right">Egresos</th>
                    <th className="px-5 py-3 text-right">Beneficio neto</th>
                  </tr>
                </thead>
                <tbody>
                  {mesesUnicos.map(mes => {
                    const ing = mapaIngresos.get(mes) ?? 0
                    const egr = mapaEgresos.get(mes) ?? 0
                    const neto = ing - egr
                    return (
                      <tr key={mes} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-5 py-3 text-zinc-300 font-medium capitalize">{mes}</td>
                        <td className="px-5 py-3 text-right text-emerald-400 font-medium">{fmt(ing)}</td>
                        <td className="px-5 py-3 text-right text-rose-400 font-medium">{fmt(egr)}</td>
                        <td className={`px-5 py-3 text-right font-bold ${neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(neto)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {mesesUnicos.length > 0 && (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">📊 Comparativa visual</h2>
              {mesesUnicos.map(mes => {
                const ing = mapaIngresos.get(mes) ?? 0
                const egr = mapaEgresos.get(mes) ?? 0
                const maxVal = Math.max(...mesesUnicos.map(m => Math.max(mapaIngresos.get(m) ?? 0, mapaEgresos.get(m) ?? 0))) || 1
                return (
                  <div key={mes} className="space-y-1.5">
                    <p className="text-xs text-zinc-500 capitalize">{mes}</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 w-16">Ingresos</span>
                        <div className="flex-1 h-2 rounded-full bg-zinc-800">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(ing / maxVal) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-emerald-400 w-16 text-right">{fmt(ing)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 w-16">Egresos</span>
                        <div className="flex-1 h-2 rounded-full bg-zinc-800">
                          <div className="h-2 rounded-full bg-rose-500" style={{ width: `${(egr / maxVal) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-rose-400 w-16 text-right">{fmt(egr)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}