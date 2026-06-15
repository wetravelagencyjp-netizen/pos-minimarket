'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Seccion = 'comprobantes' | 'credenciales' | 'clientes'

export default function FacturacionPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<Seccion>('comprobantes')

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="text-xs text-gray-400 hover:text-gray-600">← Volver al Admin</button>
          <h1 className="text-sm font-semibold text-gray-900">🧾 Facturación Electrónica SRI</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 border-r border-gray-100 bg-white p-4 space-y-1">
          {[
            { id: 'comprobantes', label: '🧾 Comprobantes' },
            { id: 'credenciales', label: '⚙️ Credenciales SRI' },
            { id: 'clientes', label: '👥 Clientes' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setSeccion(id as Seccion)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors
                ${seccion === id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}

          <div className="pt-4 border-t border-gray-100 mt-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">⚠️ Estado SRI</p>
              <p className="text-[10px] text-amber-600">Modo: Pruebas</p>
              <p className="text-[10px] text-amber-600">Configura tus credenciales para activar</p>
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

// ─── COMPROBANTES ────────────────────────────────────────────
function SeccionComprobantes({ establecimientoId }: { establecimientoId: number }) {
  const [comprobantes, setComprobantes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')

  const cargar = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('sri_comprobantes').select('*')
      .eq('establecimiento_id', establecimientoId)
      .order('creado_en', { ascending: false })
    if (filtroEstado !== 'TODOS') query = query.eq('estado', filtroEstado)
    const { data } = await query
    setComprobantes(data ?? [])
    setLoading(false)
  }, [establecimientoId, filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  const estadoColor: Record<string, string> = {
    PENDIENTE: 'bg-yellow-100 text-yellow-700',
    RECIBIDA: 'bg-blue-100 text-blue-700',
    AUTORIZADA: 'bg-green-100 text-green-700',
    RECHAZADA: 'bg-red-100 text-red-700',
    DEVUELTA: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Comprobantes electrónicos</h2>
        <div className="flex gap-2">
          {['TODOS', 'PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'DEVUELTA'].map(estado => (
            <button key={estado} onClick={() => setFiltroEstado(estado)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                ${filtroEstado === estado ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {estado}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
        ) : comprobantes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🧾</div>
            <p className="text-sm font-medium text-gray-600">No hay comprobantes todavía</p>
            <p className="text-xs text-gray-400 mt-1">Los comprobantes aparecerán aquí cuando emitas facturas desde el POS</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Número</th>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {comprobantes.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{c.numero_comprobante}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900 text-xs">{c.cliente_razon_social}</p>
                    <p className="text-gray-400 text-[10px]">{c.cliente_identificacion}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {new Date(c.fecha_emision).toLocaleDateString('es-EC')}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">${c.total?.toFixed(2)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoColor[c.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {c.xml_autorizado && (
                        <button onClick={() => {
                          const blob = new Blob([c.xml_autorizado], { type: 'text/xml' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${c.clave_acceso}.xml`
                          a.click()
                        }} className="text-xs text-blue-500 hover:text-blue-700">
                          📥 XML
                        </button>
                      )}
                      {c.ride_pdf_url && (
                        <a href={c.ride_pdf_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-500 hover:text-green-700">
                          📄 RIDE
                        </a>
                      )}
                      {c.estado === 'PENDIENTE' && (
                        <button className="text-xs text-amber-500 hover:text-amber-700">
                          🔄 Reintentar
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

// ─── CREDENCIALES SRI ────────────────────────────────────────────
function SeccionCredenciales({ establecimientoId }: { establecimientoId: number }) {
  const [credenciales, setCredenciales] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)
  const [form, setForm] = useState({
    ruc: '',
    razon_social: '',
    nombre_comercial: '',
    direccion_matriz: '',
    direccion_establecimiento: '',
    codigo_establecimiento: '001',
    codigo_punto_emision: '001',
    tipo_emision: 'pruebas',
    obligado_contabilidad: false,
    regimen: 'general',
    contribuyente_especial: '',
    firma_password_encrypted: '',
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
        direccion_establecimiento: data.direccion_establecimiento ?? '',
        codigo_establecimiento: data.codigo_establecimiento ?? '001',
        codigo_punto_emision: data.codigo_punto_emision ?? '001',
        tipo_emision: data.tipo_emision ?? 'pruebas',
        obligado_contabilidad: data.obligado_contabilidad ?? false,
        regimen: data.regimen ?? 'general',
        contribuyente_especial: data.contribuyente_especial ?? '',
        firma_password_encrypted: '',
      })
    }
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const handleFirma = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      await supabase.from('sri_credenciales').upsert({
        establecimiento_id: establecimientoId,
        ...form,
        firma_p12_base64: base64,
      }, { onConflict: 'establecimiento_id' })
      setMensaje({ texto: '✅ Firma electrónica cargada correctamente', tipo: 'ok' })
    }
    reader.readAsDataURL(file)
  }

  const guardar = async () => {
    if (!form.ruc || !form.razon_social || !form.direccion_matriz) {
      setMensaje({ texto: '❌ RUC, Razón Social y Dirección son obligatorios', tipo: 'error' })
      return
    }
    if (form.ruc.length !== 13) {
      setMensaje({ texto: '❌ El RUC debe tener 13 dígitos', tipo: 'error' })
      return
    }
    setGuardando(true)
    setMensaje(null)
    const { error } = await supabase.from('sri_credenciales').upsert({
      establecimiento_id: establecimientoId,
      ...form,
      firma_password_encrypted: form.firma_password_encrypted || undefined,
    }, { onConflict: 'establecimiento_id' })
    if (error) {
      setMensaje({ texto: `❌ Error: ${error.message}`, tipo: 'error' })
    } else {
      setMensaje({ texto: '✅ Credenciales guardadas correctamente', tipo: 'ok' })
      cargar()
    }
    setGuardando(false)
  }

  if (loading) return <div className="text-sm text-gray-400">Cargando…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">⚙️ Credenciales SRI</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${form.tipo_emision === 'produccion' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {form.tipo_emision === 'produccion' ? '🟢 Producción' : '🟡 Pruebas'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">RUC del emisor *</label>
            <input placeholder="1234567890001" value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} maxLength={13}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Razón Social *</label>
            <input placeholder="EMPRESA S.A." value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Comercial</label>
            <input placeholder="Mi Tienda" value={form.nombre_comercial} onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dirección Matriz *</label>
            <input placeholder="Av. Principal 123, Quito" value={form.direccion_matriz} onChange={e => setForm(f => ({ ...f, direccion_matriz: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dirección Establecimiento</label>
            <input placeholder="Igual a matriz si es el mismo lugar" value={form.direccion_establecimiento} onChange={e => setForm(f => ({ ...f, direccion_establecimiento: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código Establecimiento</label>
            <input placeholder="001" value={form.codigo_establecimiento} onChange={e => setForm(f => ({ ...f, codigo_establecimiento: e.target.value }))} maxLength={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Punto de Emisión</label>
            <input placeholder="001" value={form.codigo_punto_emision} onChange={e => setForm(f => ({ ...f, codigo_punto_emision: e.target.value }))} maxLength={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Emisión</label>
            <select value={form.tipo_emision} onChange={e => setForm(f => ({ ...f, tipo_emision: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="pruebas">🟡 Pruebas (SRI Certificación)</option>
              <option value="produccion">🟢 Producción (SRI Real)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Régimen</label>
            <select value={form.regimen} onChange={e => setForm(f => ({ ...f, regimen: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="general">General</option>
              <option value="rimpe">RIMPE</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <input type="checkbox" id="obligado" checked={form.obligado_contabilidad} onChange={e => setForm(f => ({ ...f, obligado_contabilidad: e.target.checked }))}
              className="rounded border-gray-300" />
            <label htmlFor="obligado" className="text-sm text-gray-700">Obligado a llevar contabilidad</label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Contribuyente Especial (número, si aplica)</label>
            <input placeholder="Dejar vacío si no aplica" value={form.contribuyente_especial} onChange={e => setForm(f => ({ ...f, contribuyente_especial: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
        </div>

        {mensaje && (
          <div className={`rounded-lg px-3 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {mensaje.texto}
          </div>
        )}

        <button onClick={guardar} disabled={guardando}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {guardando ? 'Guardando…' : '✅ Guardar credenciales'}
        </button>
      </div>

      {/* Firma electrónica */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">🔐 Firma Electrónica (.p12)</h2>
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
          <div className="text-3xl mb-2">🔑</div>
          <p className="text-sm text-gray-600 mb-3">
            {credenciales?.firma_p12_base64 ? '✅ Firma cargada — puedes actualizarla' : 'Sube tu archivo de firma electrónica'}
          </p>
          <input type="file" accept=".p12" onChange={handleFirma} className="hidden" id="firma-file" />
          <label htmlFor="firma-file" className="cursor-pointer rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200">
            📁 Seleccionar archivo .p12
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña de la firma</label>
          <input type="password" placeholder="Contraseña del archivo .p12" value={form.firma_password_encrypted}
            onChange={e => setForm(f => ({ ...f, firma_password_encrypted: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
        </div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          ℹ️ La firma electrónica se almacena de forma segura y encriptada. Necesitas obtenerla en el Banco Central del Ecuador o un proveedor autorizado.
        </div>
      </div>
    </div>
  )
}

// ─── CLIENTES ────────────────────────────────────────────
function SeccionClientes({ establecimientoId }: { establecimientoId: number }) {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ identificacion: '', tipo_identificacion: 'cedula', razon_social: '', direccion: '', email: '', telefono: '' })
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

  const validarIdentificacion = (id: string, tipo: string) => {
    if (tipo === 'consumidor_final') return true
    if (tipo === 'cedula') return id.length === 10
    if (tipo === 'ruc') return id.length === 13
    if (tipo === 'pasaporte') return id.length >= 5
    return false
  }

  const guardar = async () => {
    if (!form.identificacion || !form.razon_social) {
      setMensaje({ texto: '❌ Identificación y nombre son obligatorios', tipo: 'error' })
      return
    }
    if (!validarIdentificacion(form.identificacion, form.tipo_identificacion)) {
      setMensaje({ texto: '❌ Identificación inválida — Cédula: 10 dígitos, RUC: 13 dígitos', tipo: 'error' })
      return
    }
    if (form.tipo_identificacion !== 'consumidor_final' && !form.email) {
      setMensaje({ texto: '❌ El correo electrónico es obligatorio para enviar el comprobante', tipo: 'error' })
      return
    }
    setGuardando(true)
    setMensaje(null)
    const { error } = await supabase.from('clientes').upsert({
      establecimiento_id: establecimientoId,
      ...form,
    }, { onConflict: 'establecimiento_id,identificacion' })
    if (error) {
      setMensaje({ texto: `❌ Error: ${error.message}`, tipo: 'error' })
    } else {
      setMensaje({ texto: '✅ Cliente guardado correctamente', tipo: 'ok' })
      setForm({ identificacion: '', tipo_identificacion: 'cedula', razon_social: '', direccion: '', email: '', telefono: '' })
      cargar()
    }
    setGuardando(false)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.identificacion.includes(busqueda)
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">➕ Nuevo cliente</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de identificación</label>
            <select value={form.tipo_identificacion} onChange={e => setForm(f => ({ ...f, tipo_identificacion: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="cedula">Cédula (10 dígitos)</option>
              <option value="ruc">RUC (13 dígitos)</option>
              <option value="pasaporte">Pasaporte</option>
              <option value="consumidor_final">Consumidor Final</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Número de identificación *
              {form.tipo_identificacion === 'cedula' && <span className="text-gray-400 ml-1">(10 dígitos)</span>}
              {form.tipo_identificacion === 'ruc' && <span className="text-gray-400 ml-1">(13 dígitos)</span>}
            </label>
            <input placeholder={form.tipo_identificacion === 'consumidor_final' ? '9999999999999' : form.tipo_identificacion === 'cedula' ? '1234567890' : '1234567890001'}
              value={form.identificacion} onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre / Razón Social *</label>
            <input placeholder="Juan Pérez o EMPRESA S.A." value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
            <input placeholder="Av. Principal 123, Ciudad" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Correo electrónico {form.tipo_identificacion !== 'consumidor_final' && <span className="text-red-500">*</span>}
            </label>
            <input type="email" placeholder="cliente@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
            <input placeholder="0999999999" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
        </div>
        {mensaje && (
          <div className={`rounded-lg px-3 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {mensaje.texto}
          </div>
        )}
        <button onClick={guardar} disabled={guardando}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {guardando ? 'Guardando…' : '✅ Guardar cliente'}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">👥 Clientes ({clientes.length})</h2>
          <input placeholder="Buscar por nombre o identificación…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-blue-400" />
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Identificación</th>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Correo</th>
                <th className="px-5 py-3 text-left">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{c.identificacion}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{c.razon_social}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{c.email ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{c.telefono ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
