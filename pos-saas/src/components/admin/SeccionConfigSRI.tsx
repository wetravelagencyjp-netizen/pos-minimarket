'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface FirmaSocio {
  id: string
  nombre: string
  ruc: string
  puntoEmision: string
  archivoNombre: string
  p12Base64: string | null
  clave: string
}

export default function SeccionConfigSRI({ establecimientoId }: { establecimientoId: number }) {
  const [tab, setTab] = useState<'general' | 'firmas'>('general')
  const [credenciales, setCredenciales] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  // Multi-firma
  const [multiSocio, setMultiSocio] = useState(false)
  const [numSocios, setNumSocios] = useState(2)
  const [firmas, setFirmas] = useState<FirmaSocio[]>([])

  const [form, setForm] = useState({
    ruc: '', razon_social: '', nombre_comercial: '',
    direccion_matriz: '', codigo_establecimiento: '001',
    codigo_punto_emision: '001', tipo_emision: 'pruebas',
    regimen: 'general', obligado_contabilidad: false,
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sri_credenciales')
      .select('*').eq('establecimiento_id', establecimientoId).maybeSingle()
    if (data) {
      setCredenciales(data)
      setForm({
        ruc: data.ruc ?? '',
        razon_social: data.razon_social ?? '',
        nombre_comercial: data.nombre_comercial ?? '',
        direccion_matriz: data.direccion_matriz ?? '',
        codigo_establecimiento: data.codigo_establecimiento ?? '001',
        codigo_punto_emision: data.codigo_punto_emision ?? '001',
        tipo_emision: data.tipo_emision ?? 'pruebas',
        regimen: data.regimen ?? 'general',
        obligado_contabilidad: data.obligado_contabilidad ?? false,
      })
    }
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  // Generar bloques de firmas cuando cambia numSocios
  useEffect(() => {
    if (!multiSocio) return
    setFirmas(prev => {
      const nuevas: FirmaSocio[] = []
      for (let i = 0; i < numSocios; i++) {
        nuevas.push(prev[i] ?? {
          id: `socio_${i}`,
          nombre: '',
          ruc: '',
          puntoEmision: `00${i + 1}`,
          archivoNombre: '',
          p12Base64: null,
          clave: '',
        })
      }
      return nuevas
    })
  }, [numSocios, multiSocio])

  const actualizarFirma = (idx: number, campo: keyof FirmaSocio, valor: any) => {
    setFirmas(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f))
  }

  const handleP12Socio = (idx: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      actualizarFirma(idx, 'p12Base64', base64)
      actualizarFirma(idx, 'archivoNombre', file.name)
    }
    reader.readAsDataURL(file)
  }

  const guardarGeneral = async () => {
    if (!form.ruc || !form.razon_social) { setMensaje('❌ RUC y Razón Social son obligatorios'); return }
    setGuardando(true)
    const { error } = await supabase.from('sri_credenciales').upsert(
      { establecimiento_id: establecimientoId, ...form },
      { onConflict: 'establecimiento_id' }
    )
    setGuardando(false)
    setMensaje(error ? `❌ ${error.message}` : '✅ Configuración guardada')
    if (!error) cargar()
  }

  const inp = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'
  const btnPrimary = 'rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors'

  if (loading) return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>

  return (
    <div className="space-y-5 text-zinc-100">
      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 rounded-2xl p-1 w-fit">
        {[{ id: 'general', label: '🏢 Datos del emisor' }, { id: 'firmas', label: '🔐 Firmas electrónicas' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {mensaje && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${mensaje.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {mensaje}
        </div>
      )}

      {/* ── GENERAL ── */}
      {tab === 'general' && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">🏢 Datos del Emisor</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${form.tipo_emision === 'produccion' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {form.tipo_emision === 'produccion' ? 'Producción' : 'Pruebas'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500 block mb-1">RUC *</label>
              <input placeholder="1234567890001" value={form.ruc} maxLength={13}
                onChange={e => setForm(f => ({ ...f, ruc: e.target.value.replace(/\D/g, '') }))}
                className={`${inp} font-mono`} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500 block mb-1">Razón Social *</label>
              <input placeholder="EMPRESA S.A." value={form.razon_social}
                onChange={e => setForm(f => ({ ...f, razon_social: e.target.value.toUpperCase() }))} className={inp} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Nombre Comercial</label>
              <input placeholder="Mi Tienda" value={form.nombre_comercial}
                onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Tipo de Emisión</label>
              <select value={form.tipo_emision} onChange={e => setForm(f => ({ ...f, tipo_emision: e.target.value }))} className={inp}>
                <option value="pruebas">Pruebas</option>
                <option value="produccion">Producción</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500 block mb-1">Dirección Matriz *</label>
              <input placeholder="Av. Principal 123, Quito" value={form.direccion_matriz}
                onChange={e => setForm(f => ({ ...f, direccion_matriz: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Código Establecimiento</label>
              <input placeholder="001" value={form.codigo_establecimiento} maxLength={3}
                onChange={e => setForm(f => ({ ...f, codigo_establecimiento: e.target.value }))}
                className={`${inp} font-mono`} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Punto de Emisión</label>
              <input placeholder="001" value={form.codigo_punto_emision} maxLength={3}
                onChange={e => setForm(f => ({ ...f, codigo_punto_emision: e.target.value }))}
                className={`${inp} font-mono`} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Régimen</label>
              <select value={form.regimen} onChange={e => setForm(f => ({ ...f, regimen: e.target.value }))} className={inp}>
                <option value="general">General</option>
                <option value="rimpe">RIMPE</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input type="checkbox" id="obligado" checked={form.obligado_contabilidad}
                onChange={e => setForm(f => ({ ...f, obligado_contabilidad: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-600" />
              <label htmlFor="obligado" className="text-sm text-zinc-400">Obligado a llevar contabilidad</label>
            </div>
          </div>
          <button onClick={guardarGeneral} disabled={guardando} className={btnPrimary}>
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      )}

      {/* ── FIRMAS ── */}
      {tab === 'firmas' && (
        <div className="space-y-4">
          {/* Toggle multi-socio */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">🔐 Firmas Electrónicas</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Configura el certificado .p12 para emisión de facturas</p>
              </div>
            </div>

            {/* Switch multi-socio */}
            <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-200">¿Este negocio tiene múltiples socios/firmas?</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Activa si varios socios emiten facturas con distintos .p12</p>
                </div>
                <button type="button" onClick={() => setMultiSocio(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${multiSocio ? 'bg-indigo-600' : 'bg-zinc-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${multiSocio ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {multiSocio && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-zinc-400">Número de socios:</label>
                  <input type="number" min={2} max={10} value={numSocios}
                    onChange={e => setNumSocios(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))}
                    className="w-16 rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 text-center" />
                </div>
              )}
            </div>
          </div>

          {/* Bloque firma única */}
          {!multiSocio && (
            <FirmaBloque
              titulo="Firma principal"
              ruc={form.ruc}
              puntoEmision={form.codigo_punto_emision}
              establecimientoId={establecimientoId}
              tieneCertificado={!!credenciales?.certificado_p12}
              nombreArchivo={credenciales?.certificado_nombre ?? ''}
            />
          )}

          {/* Bloques multi-socio */}
          {multiSocio && firmas.map((firma, idx) => (
            <div key={firma.id} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">👤 Socio {idx + 1}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Nombre del socio *" value={firma.nombre}
                  onChange={e => actualizarFirma(idx, 'nombre', e.target.value)} className={inp} />
                <input placeholder="RUC del socio *" value={firma.ruc}
                  onChange={e => actualizarFirma(idx, 'ruc', e.target.value)} className={`${inp} font-mono`} />
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Punto de emisión</label>
                  <input placeholder="001" value={firma.puntoEmision} maxLength={3}
                    onChange={e => actualizarFirma(idx, 'puntoEmision', e.target.value)}
                    className={`${inp} font-mono`} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Contraseña del .p12</label>
                  <input type="password" placeholder="••••••••" value={firma.clave}
                    onChange={e => actualizarFirma(idx, 'clave', e.target.value)} className={inp} />
                </div>
              </div>

              {/* Zona upload .p12 */}
              <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${firma.p12Base64 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-500'}`}>
                <span className="text-2xl mb-2">{firma.p12Base64 ? '✅' : '🔑'}</span>
                <span className="text-xs text-zinc-400">
                  {firma.archivoNombre || 'Subir certificado .p12'}
                </span>
                <input type="file" accept=".p12" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleP12Socio(idx, f) }} />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bloque firma simple ──────────────────────────────────
function FirmaBloque({ titulo, ruc, puntoEmision, establecimientoId, tieneCertificado, nombreArchivo }: {
  titulo: string; ruc: string; puntoEmision: string; establecimientoId: number; tieneCertificado: boolean; nombreArchivo: string
}) {
  const [clave, setClave] = useState('')
  const [guardandoClave, setGuardandoClave] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleP12 = async (file: File) => {
    if (!file.name.endsWith('.p12')) { setMsg('❌ Solo archivos .p12'); return }
    setSubiendo(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      const { error } = await supabase.from('sri_credenciales').upsert({
        establecimiento_id: establecimientoId,
        certificado_p12: base64,
        certificado_nombre: file.name,
      }, { onConflict: 'establecimiento_id' })
      setSubiendo(false)
      setMsg(error ? `❌ ${error.message}` : `✅ Certificado "${file.name}" cargado`)
    }
    reader.readAsDataURL(file)
  }

  const guardarClave = async () => {
    if (!clave) return
    setGuardandoClave(true)
    await supabase.from('sri_credenciales').upsert(
      { establecimiento_id: establecimientoId, clave_certificado: clave },
      { onConflict: 'establecimiento_id' }
    )
    setGuardandoClave(false)
    setMsg('✅ Contraseña guardada')
  }

  const inp = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">🔑 {titulo}</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full ${tieneCertificado ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
          {tieneCertificado ? 'Certificado cargado' : 'Sin certificado'}
        </span>
      </div>
      {ruc && <p className="text-xs text-zinc-500 font-mono">RUC: {ruc} · Punto emisión: {puntoEmision}</p>}

      {/* Upload .p12 */}
      <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${tieneCertificado ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-500'}`}>
        <span className="text-2xl mb-2">{tieneCertificado ? '✅' : '🔑'}</span>
        <span className="text-sm text-zinc-400">{subiendo ? 'Subiendo…' : nombreArchivo || (tieneCertificado ? 'Reemplazar .p12' : 'Subir certificado .p12')}</span>
        <span className="text-xs text-zinc-600 mt-1">Archivo .p12 del BCE o proveedor autorizado</span>
        <input type="file" accept=".p12" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleP12(f) }} />
      </label>

      {/* Contraseña */}
      <div className="flex gap-2">
        <input type="password" placeholder="Contraseña del certificado .p12" value={clave}
          onChange={e => setClave(e.target.value)} className={`flex-1 ${inp}`} />
        <button onClick={guardarClave} disabled={!clave || guardandoClave}
          className="rounded-xl bg-zinc-700 hover:bg-zinc-600 px-3.5 py-2 text-xs text-white disabled:opacity-40 transition-colors">
          Guardar
        </button>
      </div>

      {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}
    </div>
  )
}