'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Seccion = 'comprobantes' | 'credenciales' | 'clientes'

const Icon = {
  Document: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/>
      <path d="M14 3v4h4"/>
      <path d="M9 12.5h6M9 15.5h6M9 9.5h3"/>
    </svg>
  ),
  Sliders: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14"/>
      <circle cx="16" cy="6" r="1.8"/><circle cx="8" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>
    </svg>
  ),
  Users: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      <circle cx="17" cy="9" r="2.3"/><path d="M15 14.3c2.7.4 4.8 2.6 4.8 5.4"/>
    </svg>
  ),
  Building: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1.5"/>
      <path d="M9 8h1.2M13.8 8H15M9 12h1.2M13.8 12H15M9 16h1.2M13.8 16H15"/>
      <path d="M9.5 21v-3h5v3"/>
    </svg>
  ),
  Key: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="15" r="3.5"/><path d="M9.5 12.5L19 3M15.3 6.2l2.2 2.2M18.3 3.2l2.2 2.2"/>
    </svg>
  ),
  Sun: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    </svg>
  ),
  Upload: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>
    </svg>
  ),
  Check: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 16.5h.01"/>
      <path d="M10.3 3.9L2.5 17.5a1.5 1.5 0 001.3 2.3h16.4a1.5 1.5 0 001.3-2.3L13.7 3.9a1.5 1.5 0 00-2.6 0z"/>
    </svg>
  ),
  Plus: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Download: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v10m0 0l-3-3m3 3l3-3"/><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"/>
    </svg>
  ),
  ArrowLeft: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  Search: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
    </svg>
  ),
}

export default function FacturacionPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<Seccion>('comprobantes')

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <Icon.ArrowLeft className="h-3.5 w-3.5" /> Volver al Admin
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon.Document className="h-4 w-4 text-indigo-500" /> Facturación Electrónica SRI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">Salir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-slate-100 bg-white p-4 space-y-1">
          {[
            { id: 'comprobantes', label: 'Comprobantes', icon: Icon.Document },
            { id: 'credenciales', label: 'Credenciales SRI', icon: Icon.Sliders },
            { id: 'clientes', label: 'Clientes', icon: Icon.Users },
          ].map(({ id, label, icon: ItemIcon }) => (
            <button key={id} onClick={() => setSeccion(id as Seccion)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors
                ${seccion === id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <ItemIcon className="h-4 w-4" /> {label}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
                <Icon.Alert className="h-3.5 w-3.5" /> Estado SRI
              </p>
              <p className="text-[11px] text-amber-600">Modo: Pruebas</p>
              <p className="text-[11px] text-amber-600">Configura tus credenciales para activar</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {seccion === 'comprobantes' && <SeccionComprobantes establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'credenciales' && <SeccionCredenciales establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'clientes' && <SeccionClientes establecimientoId={usuario?.establecimiento_id ?? 1} />}
        </main>
      </div>
    </div>
  )
}

// ─── COMPROBANTES ─────────────────────────────────────────────
function SeccionComprobantes({ establecimientoId }: { establecimientoId: number }) {
  const [comprobantes, setComprobantes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')

  const cargar = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('sri_comprobantes').select('*')
      .eq('establecimiento_id', establecimientoId)
      .order('fecha_emision', { ascending: false })
    if (filtroEstado !== 'TODOS') query = query.eq('estado', filtroEstado)
    const { data } = await query
    setComprobantes(data ?? [])
    setLoading(false)
  }, [establecimientoId, filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  const estadoColor: Record<string, string> = {
    PENDIENTE: 'bg-amber-50 text-amber-700',
    FIRMADO: 'bg-blue-50 text-blue-700',
    FIRMADO_SIMULADO: 'bg-slate-100 text-slate-600',
    ENVIADO: 'bg-violet-50 text-violet-700',
    AUTORIZADO: 'bg-emerald-50 text-emerald-700',
    RECHAZADO: 'bg-rose-50 text-rose-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Comprobantes electrónicos</h2>
        <div className="flex gap-2 flex-wrap">
          {['TODOS', 'PENDIENTE', 'FIRMADO', 'AUTORIZADO', 'RECHAZADO'].map(estado => (
            <button key={estado} onClick={() => setFiltroEstado(estado)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                ${filtroEstado === estado ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {estado}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando…</div>
        ) : comprobantes.length === 0 ? (
          <div className="p-14 text-center">
            <Icon.Document className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No hay comprobantes todavía</p>
            <p className="text-xs text-slate-400 mt-1">Los comprobantes aparecerán aquí cuando emitas facturas desde el POS</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Número</th>
                <th className="px-6 py-4 text-left font-medium">Cliente</th>
                <th className="px-6 py-4 text-left font-medium">Fecha</th>
                <th className="px-6 py-4 text-right font-medium">Total</th>
                <th className="px-6 py-4 text-center font-medium">Estado</th>
                <th className="px-6 py-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {comprobantes.map(c => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{c.numero_comprobante}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800 text-xs">{c.cliente_razon_social}</p>
                    <p className="text-slate-400 text-[11px]">{c.cliente_identificacion}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(c.fecha_emision).toLocaleDateString('es-EC')}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-800">${c.total?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${estadoColor[c.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      {c.xml_firmado && (
                        <button onClick={() => {
                          const blob = new Blob([c.xml_firmado], { type: 'text/xml' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = `${c.clave_acceso}.xml`; a.click()
                        }} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                          <Icon.Download className="h-3.5 w-3.5" /> XML
                        </button>
                      )}
                      {c.xml_generado && !c.xml_firmado && (
                        <button onClick={() => {
                          const blob = new Blob([c.xml_generado], { type: 'text/xml' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = `${c.numero_comprobante}.xml`; a.click()
                        }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                          <Icon.Download className="h-3.5 w-3.5" /> XML
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── CREDENCIALES SRI ─────────────────────────────────────────
function SeccionCredenciales({ establecimientoId }: { establecimientoId: number }) {
  const [credenciales, setCredenciales] = useState<any>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [modoMultivendedor, setModoMultivendedor] = useState(true)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info' } | null>(null)
  const [archivoNombre, setArchivoNombre] = useState<string>('')
  const [claveP12, setClaveP12] = useState('')
  const [form, setForm] = useState({
    ruc: '', razon_social: '', nombre_comercial: '',
    direccion_matriz: '', direccion_establecimiento: '',
    codigo_establecimiento: '001', codigo_punto_emision: '001',
    tipo_emision: 'pruebas', obligado_contabilidad: false,
    regimen: 'general', contribuyente_especial: '',
    es_negocio_turistico: false, iva_reducido_activo: false,
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sri_credenciales')
      .select('*').eq('establecimiento_id', establecimientoId).maybeSingle()
    const { data: estab } = await supabase.from('establecimientos')
      .select('logo_url, modo_multivendedor').eq('id', establecimientoId).maybeSingle()
    setLogoUrl(estab?.logo_url ?? null)
    setModoMultivendedor(estab?.modo_multivendedor ?? true)
    if (data) {
      setCredenciales(data)
      setArchivoNombre(data.certificado_nombre ?? '')
      setForm({
        ruc: data.ruc ?? '',
        razon_social: data.razon_social ?? '',
        nombre_comercial: data.nombre_comercial ?? '',
        direccion_matriz: data.direccion_matriz ?? '',
        direccion_establecimiento: data.direccion_establecimiento ?? '',
        codigo_establecimiento: data.codigo_establecimiento ?? '001',
        codigo_punto_emision: data.codigo_punto_emision ?? '001',
        tipo_emision: data.tipo_emision ?? 'pruebas',
        obligado_contabilidad: data.obligado_contabilidad ?? false,
        regimen: data.regimen ?? 'general',
        contribuyente_especial: data.contribuyente_especial ?? '',
        es_negocio_turistico: data.es_negocio_turistico ?? false,
        iva_reducido_activo: data.iva_reducido_activo ?? false,
      })
    }
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardarModoMultivendedor = async (valor: boolean) => {
    setModoMultivendedor(valor)
    const { error } = await supabase.from('establecimientos').update({ modo_multivendedor: valor }).eq('id', establecimientoId)
    if (error) {
      setModoMultivendedor(!valor)
      setMensaje({ texto: `Error: ${error.message}`, tipo: 'error' })
    } else {
      setMensaje({ texto: valor ? 'Modo multivendedor activado' : 'Modo multivendedor desactivado', tipo: 'ok' })
    }
  }

  const handleP12 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.p12')) {
      setMensaje({ texto: 'Solo se aceptan archivos .p12', tipo: 'error' })
      return
    }
    setArchivoNombre(file.name)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      const { error } = await supabase.from('sri_credenciales').upsert({
        establecimiento_id: establecimientoId,
        certificado_p12: base64,
        certificado_nombre: file.name,
        clave_certificado: claveP12 || undefined,
        ...form,
      }, { onConflict: 'establecimiento_id' })
      if (error) {
        setMensaje({ texto: `Error al subir: ${error.message}`, tipo: 'error' })
      } else {
        setMensaje({ texto: `Certificado "${file.name}" cargado correctamente`, tipo: 'ok' })
        cargar()
      }
    }
    reader.readAsDataURL(file)
  }

  const guardarClave = async () => {
    if (!claveP12) return
    const { error } = await supabase.from('sri_credenciales').upsert({
      establecimiento_id: establecimientoId,
      clave_certificado: claveP12,
      ...form,
    }, { onConflict: 'establecimiento_id' })
    if (!error) setMensaje({ texto: 'Contraseña guardada', tipo: 'ok' })
  }

  const probarFirma = async () => {
    setProbando(true)
    setMensaje({ texto: 'Probando firma digital…', tipo: 'info' })
    try {
      const r = await fetch('/api/usuarios/sri/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xml: '<factura id="comprobante" version="1.1.0"><prueba>test</prueba></factura>',
          establecimiento_id: establecimientoId,
        }),
      })
      const data = await r.json()
      if (data.ok && !data.simulado) {
        setMensaje({ texto: 'Firma digital funcionando correctamente con tu certificado .p12', tipo: 'ok' })
      } else if (data.ok && data.simulado) {
        setMensaje({ texto: 'Modo simulación — sube tu certificado .p12 y contraseña para firma real', tipo: 'info' })
      } else {
        setMensaje({ texto: `Error: ${data.error}`, tipo: 'error' })
      }
    } catch {
      setMensaje({ texto: 'Error de conexión al probar la firma', tipo: 'error' })
    }
    setProbando(false)
  }

  const guardar = async () => {
    if (!form.ruc || !form.razon_social || !form.direccion_matriz) {
      setMensaje({ texto: 'RUC, Razón Social y Dirección son obligatorios', tipo: 'error' }); return
    }
    if (form.ruc.length !== 13) {
      setMensaje({ texto: 'El RUC debe tener 13 dígitos', tipo: 'error' }); return
    }
    setGuardando(true); setMensaje(null)
    const { error } = await supabase.from('sri_credenciales').upsert({
      establecimiento_id: establecimientoId, ...form,
    }, { onConflict: 'establecimiento_id' })
    if (error) {
      setMensaje({ texto: `Error: ${error.message}`, tipo: 'error' })
    } else {
      setMensaje({ texto: 'Credenciales guardadas correctamente', tipo: 'ok' })
      cargar()
    }
    setGuardando(false)
  }

  if (loading) return <div className="text-sm text-slate-400">Cargando…</div>

  const tieneCertificado = !!credenciales?.certificado_p12
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white"

  return (
    <div className="space-y-6 max-w-2xl">

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon.Building className="h-4 w-4 text-indigo-500" /> Datos del Emisor
          </h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${form.tipo_emision === 'produccion' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {form.tipo_emision === 'produccion' ? 'Producción' : 'Pruebas'}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">RUC del emisor *</label>
            <input placeholder="1234567890001" value={form.ruc} maxLength={13}
              onChange={e => setForm(f => ({ ...f, ruc: e.target.value.replace(/\D/g, '') }))}
              className={`${inputClass} font-mono`} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Razón Social *</label>
            <input placeholder="EMPRESA S.A." value={form.razon_social}
              onChange={e => setForm(f => ({ ...f, razon_social: e.target.value.toUpperCase() }))}
              className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre Comercial</label>
            <input placeholder="Mi Tienda" value={form.nombre_comercial}
              onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))}
              className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Dirección Matriz *</label>
            <input placeholder="Av. Principal 123, Quito" value={form.direccion_matriz}
              onChange={e => setForm(f => ({ ...f, direccion_matriz: e.target.value }))}
              className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Dirección Establecimiento</label>
            <input placeholder="Igual a matriz si es el mismo lugar" value={form.direccion_establecimiento}
              onChange={e => setForm(f => ({ ...f, direccion_establecimiento: e.target.value }))}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Código Establecimiento</label>
            <input placeholder="001" value={form.codigo_establecimiento} maxLength={3}
              onChange={e => setForm(f => ({ ...f, codigo_establecimiento: e.target.value }))}
              className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Punto de Emisión</label>
            <input placeholder="001" value={form.codigo_punto_emision} maxLength={3}
              onChange={e => setForm(f => ({ ...f, codigo_punto_emision: e.target.value }))}
              className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo de Emisión</label>
            <select value={form.tipo_emision} onChange={e => setForm(f => ({ ...f, tipo_emision: e.target.value }))}
              className={inputClass}>
              <option value="pruebas">Pruebas (SRI Certificación)</option>
              <option value="produccion">Producción (SRI Real)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Régimen</label>
            <select value={form.regimen} onChange={e => setForm(f => ({ ...f, regimen: e.target.value }))}
              className={inputClass}>
              <option value="general">General</option>
              <option value="rimpe">RIMPE</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <input type="checkbox" id="obligado" checked={form.obligado_contabilidad}
              onChange={e => setForm(f => ({ ...f, obligado_contabilidad: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="obligado" className="text-sm text-slate-700">Obligado a llevar contabilidad</label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contribuyente Especial (número, si aplica)</label>
            <input placeholder="Dejar vacío si no aplica" value={form.contribuyente_especial}
              onChange={e => setForm(f => ({ ...f, contribuyente_especial: e.target.value }))}
              className={inputClass} />
          </div>
        </div>
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {guardando ? 'Guardando…' : 'Guardar datos del emisor'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon.Users className="h-4 w-4 text-indigo-500" /> Modo de Operación
        </h2>
        <p className="text-sm text-slate-500">
          Activa esto si en tu local varias personas tienen productos propios que se venden juntos
          (por ejemplo, varias emprendedoras compartiendo el mismo espacio). Si tu negocio tiene un
          solo dueño, déjalo apagado para simplificar el catálogo, el carrito y los recibos.
        </p>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5">
          <span className="text-sm text-slate-700">Modo Multivendedor (múltiples dueños en el mismo local)</span>
          <button type="button" onClick={() => guardarModoMultivendedor(!modoMultivendedor)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${modoMultivendedor ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modoMultivendedor ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon.Sun className="h-4 w-4 text-indigo-500" /> Tarifa de IVA Turístico (8%)
        </h2>
        <p className="text-sm text-slate-500">
          Solo aplica a establecimientos registrados en el Catastro Turístico del Ministerio de Turismo,
          y únicamente durante los feriados que el Gobierno decrete expresamente. Si no estás seguro, deja esto apagado.
        </p>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="es-turistico" checked={form.es_negocio_turistico}
            onChange={e => setForm(f => ({ ...f, es_negocio_turistico: e.target.checked, iva_reducido_activo: e.target.checked ? f.iva_reducido_activo : false }))}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <label htmlFor="es-turistico" className="text-sm text-slate-700">Mi negocio está registrado en el Catastro Turístico (LUAF vigente)</label>
        </div>
        {form.es_negocio_turistico && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
            <input type="checkbox" id="iva-reducido" checked={form.iva_reducido_activo}
              onChange={e => setForm(f => ({ ...f, iva_reducido_activo: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="iva-reducido" className="text-sm text-amber-700 flex-1">
              Activar tarifa reducida (8%) ahora — feriado turístico vigente
            </label>
          </div>
        )}
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {guardando ? 'Guardando…' : 'Guardar configuración de IVA'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon.Key className="h-4 w-4 text-indigo-500" /> Firma Electrónica (.p12)
          </h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${tieneCertificado ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {tieneCertificado ? 'Certificado cargado' : 'Sin certificado'}
          </span>
        </div>

        <div className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${tieneCertificado ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
          {tieneCertificado
            ? <Icon.Check className="h-7 w-7 mx-auto text-emerald-500 mb-2" />
            : <Icon.Key className="h-7 w-7 mx-auto text-slate-400 mb-2" />}
          <p className="text-sm text-slate-600 mb-1">
            {tieneCertificado ? `Certificado: ${archivoNombre || 'cargado'}` : 'Sube tu certificado de firma electrónica'}
          </p>
          <p className="text-xs text-slate-400 mb-3">
            {tieneCertificado ? 'Puedes reemplazarlo subiendo un nuevo archivo' : 'Archivo .p12 del BCE o proveedor autorizado'}
          </p>
          <input type="file" accept=".p12" onChange={handleP12} className="hidden" id="p12-file" />
          <label htmlFor="p12-file"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Icon.Upload className="h-3.5 w-3.5" /> {tieneCertificado ? 'Reemplazar .p12' : 'Seleccionar archivo .p12'}
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Contraseña del certificado</label>
          <div className="flex gap-2">
            <input type="password" placeholder="Contraseña del archivo .p12"
              value={claveP12} onChange={e => setClaveP12(e.target.value)}
              className={`flex-1 ${inputClass}`} />
            <button onClick={guardarClave} disabled={!claveP12}
              className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
              Guardar
            </button>
          </div>
          {credenciales?.clave_certificado && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1.5">
              <Icon.Check className="h-3 w-3" /> Contraseña guardada
            </p>
          )}
        </div>

        <button onClick={probarFirma} disabled={probando}
          className="w-full rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors">
          {probando ? 'Probando…' : 'Probar firma digital'}
        </button>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-600">¿Dónde obtengo el certificado .p12?</p>
          <p>• <strong className="text-slate-600">BCE</strong> (Banco Central del Ecuador): bce.fin.ec</p>
          <p>• <strong className="text-slate-600">Security Data</strong>: securitydata.net.ec</p>
          <p>• <strong className="text-slate-600">ANF AC Ecuador</strong>: anf.es</p>
          <p className="text-slate-400 mt-1">El certificado se almacena de forma segura en tu base de datos.</p>
        </div>
      </div>

      {mensaje && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium
          ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
            mensaje.tipo === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
            'bg-blue-50 text-blue-700 border border-blue-100'}`}>
          {mensaje.tipo === 'ok' && <Icon.Check className="h-4 w-4 shrink-0" />}
          {mensaje.tipo === 'error' && <Icon.Alert className="h-4 w-4 shrink-0" />}
          {mensaje.texto}
        </div>
      )}
    </div>
  )
}

// ─── CLIENTES ─────────────────────────────────────────────────
function SeccionClientes({ establecimientoId }: { establecimientoId: number }) {
  const { usuario } = useAuth()
  const puedeEditarCredito = usuario?.rol === 'admin'

  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ identificacion: '', tipo_identificacion: 'cedula', razon_social: '', direccion: '', email: '', telefono: '', limite_credito: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*')
      .eq('establecimiento_id', establecimientoId).order('razon_social')
    setClientes(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.identificacion || !form.razon_social) {
      setMensaje({ texto: 'Identificación y nombre son obligatorios', tipo: 'error' }); return
    }
    setGuardando(true); setMensaje(null)

    const datosAGuardar: Record<string, unknown> = { establecimiento_id: establecimientoId, ...form }
    if (puedeEditarCredito) {
      datosAGuardar.limite_credito = parseFloat(form.limite_credito) || 0
    } else {
      delete datosAGuardar.limite_credito // un no-admin nunca envía cambios a este campo, ni manipulando el form
    }

    const { error } = await supabase.from('clientes').upsert(
      datosAGuardar,
      { onConflict: 'establecimiento_id,identificacion' }
    )
    if (error) {
      setMensaje({ texto: `Error: ${error.message}`, tipo: 'error' })
    } else {
      setMensaje({ texto: 'Cliente guardado', tipo: 'ok' })
      setForm({ identificacion: '', tipo_identificacion: 'cedula', razon_social: '', direccion: '', email: '', telefono: '', limite_credito: '' })
      cargar()
    }
    setGuardando(false)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.identificacion?.includes(busqueda)
  )

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white"

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon.Plus className="h-4 w-4 text-indigo-500" /> Nuevo cliente
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo</label>
            <select value={form.tipo_identificacion} onChange={e => setForm(f => ({ ...f, tipo_identificacion: e.target.value }))}
              className={inputClass}>
              <option value="cedula">Cédula</option>
              <option value="ruc">RUC</option>
              <option value="pasaporte">Pasaporte</option>
              <option value="consumidor_final">Consumidor Final</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Número *</label>
            <input placeholder="Número de identificación" value={form.identificacion}
              onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))}
              className={`${inputClass} font-mono`} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre / Razón Social *</label>
            <input placeholder="Juan Pérez o EMPRESA S.A." value={form.razon_social}
              onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
              className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Dirección</label>
            <input placeholder="Av. Principal 123, Ciudad" value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
            <input type="email" placeholder="cliente@email.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Teléfono</label>
            <input placeholder="0999999999" value={form.telefono}
              onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Límite de Crédito Máximo
              {!puedeEditarCredito && <span className="ml-2 text-[11px] font-normal text-slate-400">(solo administradores)</span>}
            </label>
            <input type="number" step="0.01" min="0" placeholder="0.00" value={form.limite_credito}
              disabled={!puedeEditarCredito}
              onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))}
              className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} />
          </div>
        </div>
        {mensaje && (
          <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {mensaje.tipo === 'ok' ? <Icon.Check className="h-3.5 w-3.5 shrink-0" /> : <Icon.Alert className="h-3.5 w-3.5 shrink-0" />}
            {mensaje.texto}
          </div>
        )}
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 whitespace-nowrap">
            <Icon.Users className="h-4 w-4 text-indigo-500" /> Clientes ({clientes.length})
          </h2>
          <div className="relative flex-1">
            <Icon.Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input placeholder="Buscar…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-2 text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all" />
          </div>
        </div>
        {loading ? <div className="p-6 text-sm text-slate-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Identificación</th>
                <th className="px-6 py-4 text-left font-medium">Nombre</th>
                <th className="px-6 py-4 text-left font-medium">Correo</th>
                <th className="px-6 py-4 text-left font-medium">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map(c => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{c.identificacion}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{c.razon_social}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{c.email ?? '—'}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{c.telefono ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}