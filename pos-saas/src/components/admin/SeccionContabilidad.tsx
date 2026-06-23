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
  const [egresosFijosPorMes, setEgresosFijosPorMes] = useState<{ mes: string; total: number }[]>([])
  const [egresosVariablesPorMes, setEgresosVariablesPorMes] = useState<{ mes: string; total: number }[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'mes' | 'trimestre' | 'anio' | 'todo'>('mes')

  // Ajuste de saldo
  const [ajustandoCuenta, setAjustandoCuenta] = useState<Cuenta | null>(null)
  const [nuevoSaldo, setNuevoSaldo] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)

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

  const getFechaInicio = useCallback(() => {
    const hoy = new Date()
    if (filtro === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
    if (filtro === 'trimestre') return new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1).toISOString()
    if (filtro === 'anio') return new Date(hoy.getFullYear(), 0, 1).toISOString()
    return new Date(2020, 0, 1).toISOString()
  }, [filtro])

  const cargar = useCallback(async () => {
    setCargando(true)
    const fechaInicio = getFechaInicio()
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
        .gte('fecha_venta', fechaInicio),
      supabase.from('egresos_administrador').select('monto, fecha, es_recurrente, categoria:categorias_egreso(tipo)').eq('establecimiento_id', establecimientoId)
        .gte('fecha', fechaInicio.slice(0, 10)),
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
    const porMesFijo: Record<string, number> = {}
    const porMesVariable: Record<string, number> = {}
    for (const e of egAdmin ?? []) {
      const mes = new Date(e.fecha).toLocaleDateString('es-EC', { month: 'short', year: '2-digit' })
      const monto = Number(e.monto)
      porMesEgreso[mes] = (porMesEgreso[mes] ?? 0) + monto
      const tipo = (e.categoria as any)?.tipo ?? (e.es_recurrente ? 'fijo' : 'variable')
      if (tipo === 'fijo') {
        porMesFijo[mes] = (porMesFijo[mes] ?? 0) + monto
      } else {
        porMesVariable[mes] = (porMesVariable[mes] ?? 0) + monto
      }
    }
    setEgresosPorMes(Object.entries(porMesEgreso).map(([mes, total]) => ({ mes, total })))
    setEgresosFijosPorMes(Object.entries(porMesFijo).map(([mes, total]) => ({ mes, total })))
    setEgresosVariablesPorMes(Object.entries(porMesVariable).map(([mes, total]) => ({ mes, total })))

    setCargando(false)
  }, [establecimientoId, getFechaInicio])

  useEffect(() => { cargar() }, [cargar, filtro])

  const subcatFiltradas = subcategorias.filter(
    s => s.categoria_id === parseInt(formEgreso.categoria_id)
  )

  // Distribución de gastos por subcategoría (para Resumen)
  const gastosPorSubcat = Object.entries(
    egresos.reduce((acc, e) => {
      const key = (e.subcategoria as any)?.nombre ?? (e.categoria as any)?.nombre ?? 'Sin categoría'
      acc[key] = (acc[key] ?? 0) + Number(e.monto)
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const maxGasto = gastosPorSubcat[0]?.[1] || 1

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

  const guardarAjusteSaldo = async () => {
    if (!ajustandoCuenta || !nuevoSaldo) return
    setGuardandoAjuste(true)
    const { error } = await supabase.rpc('ajustar_saldo_cuenta', {
      p_cuenta_id: ajustandoCuenta.id,
      p_nuevo_saldo: parseFloat(nuevoSaldo),
      p_motivo: motivoAjuste || 'Ajuste manual',
    })
    setGuardandoAjuste(false)
    if (!error) {
      setAjustandoCuenta(null)
      setNuevoSaldo('')
      setMotivoAjuste('')
      cargar()
    }
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

  const eliminarEgreso = async (id: number) => {
    if (!confirm('¿Eliminar este egreso? El monto se devolverá a la cuenta de origen.')) return
    const { error } = await supabase.rpc('revertir_egreso_admin', { p_egreso_id: id })
    if (!error) cargar()
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

  const exportarExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Hoja 1: P&L
    const filasPlY = mesesUnicos.map(mes => {
      const ing = mapaIngresos.get(mes) ?? 0
      const variable = mapaVariables.get(mes) ?? 0
      const fijo = mapaFijos.get(mes) ?? 0
      const margenBruto = ing - variable
      const utilidadNeta = margenBruto - fijo
      return { Mes: mes, Ingresos: ing, 'Costos Variables': variable, 'Margen Bruto': margenBruto, 'Costos Fijos': fijo, 'Utilidad Neta': utilidadNeta }
    })
    const wsPL = XLSX.utils.json_to_sheet(filasPlY)
    XLSX.utils.book_append_sheet(wb, wsPL, 'P&L')

    // Hoja 2: Egresos
    const filasEgresos = egresos.map(e => ({
      Fecha: e.fecha,
      Descripción: e.descripcion,
      Categoría: (e.categoria as any)?.nombre ?? '—',
      Subcategoría: (e.subcategoria as any)?.nombre ?? '—',
      Cuenta: (e.cuenta as any)?.nombre ?? '—',
      Monto: Number(e.monto),
      Tipo: e.es_recurrente ? 'Fijo' : 'Variable',
    }))
    const wsEg = XLSX.utils.json_to_sheet(filasEgresos)
    XLSX.utils.book_append_sheet(wb, wsEg, 'Egresos')

    // Hoja 3: Saldos
    const filasСuentas = cuentas.map(c => ({
      Cuenta: c.nombre,
      Tipo: TIPO_CUENTA_LABEL[c.tipo],
      'Saldo Inicial': Number(c.saldo_inicial),
      'Saldo Actual': Number(c.saldo_actual),
    }))
    const wsCuentas = XLSX.utils.json_to_sheet(filasСuentas)
    XLSX.utils.book_append_sheet(wb, wsCuentas, 'Cuentas')

    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `contabilidad_grpm_${fecha}.xlsx`)
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
  const mapaFijos = new Map(egresosFijosPorMes.map(e => [e.mes, e.total]))
  const mapaVariables = new Map(egresosVariablesPorMes.map(e => [e.mes, e.total]))

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

      {/* Modal ajuste de saldo */}
      {ajustandoCuenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-sm font-semibold text-white">⚖️ Ajustar saldo — {ajustandoCuenta.nombre}</h2>
            <p className="text-xs text-zinc-500">Saldo actual: <span className="text-white font-medium">{fmt(Number(ajustandoCuenta.saldo_actual))}</span></p>
            <input
              type="number"
              placeholder="Nuevo saldo *"
              value={nuevoSaldo}
              onChange={e => setNuevoSaldo(e.target.value)}
              className={inputCls}
            />
            <input
              placeholder="Motivo del ajuste (ej: comisión bancaria)"
              value={motivoAjuste}
              onChange={e => setMotivoAjuste(e.target.value)}
              className={inputCls}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setAjustandoCuenta(null); setNuevoSaldo(''); setMotivoAjuste('') }}
                className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarAjusteSaldo}
                disabled={guardandoAjuste || !nuevoSaldo}
                className="flex-1 rounded-xl bg-white text-zinc-950 px-4 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
              >
                {guardandoAjuste ? 'Guardando…' : 'Confirmar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-zinc-800/50 rounded-2xl p-1 flex-wrap">
          <Tab id="resumen" label="📊 Resumen" />
          <Tab id="cuentas" label="💰 Cuentas" />
          <Tab id="egresos" label="💸 Egresos" />
          <Tab id="transferencias" label="🔄 Transferencias" />
          <Tab id="balance" label="📈 Balance" />
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          📥 Exportar Excel
        </button>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">💳 Saldos por cuenta</h2>
              {cuentas.length === 0 ? (
                <p className="text-xs text-zinc-500">No hay cuentas.</p>
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
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</span>
                    <span className="text-sm font-bold text-emerald-400">{fmt(totalSaldoActual)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Distribución de gastos */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">🔍 ¿A dónde va el dinero?</h2>
              {gastosPorSubcat.length === 0 ? (
                <p className="text-xs text-zinc-500">Sin egresos registrados.</p>
              ) : (
                gastosPorSubcat.map(([nombre, monto], i) => (
                  <div key={nombre} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 truncate max-w-[140px]">{nombre}</span>
                      <span className="text-rose-400 font-medium">{fmt(monto)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div
                        className={`h-1.5 rounded-full ${i === 0 ? 'bg-rose-500' : i === 1 ? 'bg-amber-500' : i === 2 ? 'bg-orange-500' : 'bg-zinc-500'}`}
                        style={{ width: `${(monto / maxGasto) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map(c => (
                    <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-zinc-200 font-medium">{c.nombre}</td>
                      <td className={`px-5 py-3 text-xs ${TIPO_CUENTA_COLOR[c.tipo]}`}>{TIPO_CUENTA_LABEL[c.tipo]}</td>
                      <td className="px-5 py-3 text-right text-zinc-500">{fmt(Number(c.saldo_inicial))}</td>
                      <td className="px-5 py-3 text-right text-white font-bold">{fmt(Number(c.saldo_actual))}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => { setAjustandoCuenta(c); setNuevoSaldo(String(c.saldo_actual)) }}
                          className="text-xs font-medium text-zinc-500 hover:text-amber-400 transition-colors"
                        >
                          ⚖️ Ajustar
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-800/30">
                    <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total consolidado</td>
                    <td className="px-5 py-3 text-right text-emerald-400 font-bold">{fmt(totalSaldoActual)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </div>

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
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Historial ({egresos.length})</h2>
              <div className="flex gap-1 bg-zinc-800 rounded-xl p-0.5">
                {[{ id: 'mes', label: 'Mes' }, { id: 'trimestre', label: 'Trim.' }, { id: 'anio', label: 'Año' }, { id: 'todo', label: 'Todo' }].map(({ id, label }) => (
                  <button key={id} onClick={() => setFiltro(id as typeof filtro)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${filtro === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
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
                        <button onClick={() => eliminarEgreso(e.id)} className="text-xs text-zinc-600 hover:text-rose-400 transition-colors" title="Eliminar y revertir saldo">✕</button>
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
          <div className="flex gap-1 bg-zinc-800/50 rounded-2xl p-1 w-fit">
            {[
              { id: 'mes', label: 'Este mes' },
              { id: 'trimestre', label: 'Trimestre' },
              { id: 'anio', label: 'Este año' },
              { id: 'todo', label: 'Todo' },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setFiltro(id as typeof filtro)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  filtro === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">📊 Estado de Resultados (P&L)</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Ingresos − Costos Variables = Margen Bruto − Costos Fijos = Utilidad Neta</p>
            </div>
            {mesesUnicos.length === 0 ? <p className="p-5 text-xs text-zinc-500">Sin datos en este período.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Mes</th>
                    <th className="px-5 py-3 text-right">Ingresos</th>
                    <th className="px-5 py-3 text-right">− C. Variables</th>
                    <th className="px-5 py-3 text-right">= Margen Bruto</th>
                    <th className="px-5 py-3 text-right">− C. Fijos</th>
                    <th className="px-5 py-3 text-right">= Utilidad Neta</th>
                  </tr>
                </thead>
                <tbody>
                  {mesesUnicos.map(mes => {
                    const ing = mapaIngresos.get(mes) ?? 0
                    const variable = mapaVariables.get(mes) ?? 0
                    const fijo = mapaFijos.get(mes) ?? 0
                    const margenBruto = ing - variable
                    const utilidadNeta = margenBruto - fijo
                    return (
                      <tr key={mes} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-5 py-3 text-zinc-300 font-medium capitalize">{mes}</td>
                        <td className="px-5 py-3 text-right text-emerald-400">{fmt(ing)}</td>
                        <td className="px-5 py-3 text-right text-rose-400">-{fmt(variable)}</td>
                        <td className={`px-5 py-3 text-right font-medium ${margenBruto >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{fmt(margenBruto)}</td>
                        <td className="px-5 py-3 text-right text-amber-400">-{fmt(fijo)}</td>
                        <td className={`px-5 py-3 text-right font-bold ${utilidadNeta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(utilidadNeta)}</td>
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