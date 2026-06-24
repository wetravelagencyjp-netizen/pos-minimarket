'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────
interface ItemXML {
  nombre: string
  cantidad: number
  precioUnitario: number
  codigoXML: string
  productoId: number | null
  productoNombre: string | null
  mapeadoAutomatico: boolean
}

interface ItemExcel {
  nombre: string
  codigoBarras: string
  cantidad: number
  precioCompra: number
  precioVenta: number | null
  productoExistente?: { id: number; nombre: string; stock_actual: number } | null
}

interface ProductoCatalogo {
  id: number
  nombre: string
  codigo_barras: string | null
  stock_actual: number
}

type Vista = 'inicio' | 'mapeo_xml' | 'preview_excel'

// ─── Selector de producto con autocomplete ────────────────
function SelectorProducto({
  productos,
  valorActual,
  onChange,
  placeholder = 'Buscar producto…',
}: {
  productos: ProductoCatalogo[]
  valorActual: number | null
  onChange: (id: number | null, nombre: string | null) => void
  placeholder?: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const productoActual = productos.find(p => p.id === valorActual)

  const filtrados = busqueda.length >= 1
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo_barras ?? '').includes(busqueda)
      ).slice(0, 6)
    : []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (productoActual && !abierto) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-400 font-medium truncate max-w-[160px]">{productoActual.nombre}</span>
        <button
          type="button"
          onClick={() => { onChange(null, null); setBusqueda(''); setAbierto(true) }}
          className="text-[10px] text-zinc-600 hover:text-rose-400 transition-colors flex-shrink-0"
        >✕</button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl z-50 max-h-40 overflow-y-auto">
          {filtrados.map(p => (
            <button
              key={p.id}
              type="button"
              onPointerDown={e => {
                e.preventDefault()
                onChange(p.id, p.nombre)
                setBusqueda('')
                setAbierto(false)
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-200 transition-colors"
            >
              <span className="truncate text-left">{p.nombre}</span>
              <span className="text-zinc-500 ml-2 flex-shrink-0">{p.stock_actual} uds</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal creación rápida de producto ───────────────────
function ModalCrearProducto({
  nombreSugerido,
  establecimientoId,
  onCreado,
  onCerrar,
}: {
  nombreSugerido: string
  establecimientoId: number
  onCreado: (producto: ProductoCatalogo) => void
  onCerrar: () => void
}) {
  const [form, setForm] = useState({ nombre: nombreSugerido, precio_venta: '', precio_costo: '', stock_actual: '0' })
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!form.nombre || !form.precio_venta) return
    setGuardando(true)
    const { data, error } = await supabase.from('productos').insert({
      establecimiento_id: establecimientoId,
      nombre: form.nombre,
      precio_venta: parseFloat(form.precio_venta),
      precio_costo: form.precio_costo ? parseFloat(form.precio_costo) : null,
      stock_actual: parseInt(form.stock_actual) || 0,
      visible_en_catalogo: true,
    }).select('id, nombre, codigo_barras, stock_actual').single()
    setGuardando(false)
    if (!error && data) onCreado(data)
  }

  const inputCls = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">➕ Crear producto rápido</h2>
          <button onClick={onCerrar} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
        </div>
        <input placeholder="Nombre del producto *" value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
        <input type="number" placeholder="Precio de venta *" value={form.precio_venta}
          onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))} className={inputCls} />
        <input type="number" placeholder="Precio de costo" value={form.precio_costo}
          onChange={e => setForm(f => ({ ...f, precio_costo: e.target.value }))} className={inputCls} />
        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || !form.nombre || !form.precio_venta}
            className="flex-1 rounded-xl bg-white text-zinc-950 px-4 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
            {guardando ? 'Creando…' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────
export default function IngresoInventarioInteligente({ establecimientoId }: { establecimientoId: number }) {
  const [vista, setVista] = useState<Vista>('inicio')
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info' } | null>(null)

  // XML state
  const [itemsXML, setItemsXML] = useState<ItemXML[]>([])
  const [metaXML, setMetaXML] = useState<{ ruc: string; nombre: string; autorizacion: string; fecha: string } | null>(null)
  const [productos, setProductos] = useState<ProductoCatalogo[]>([])
  const [modalCrear, setModalCrear] = useState<{ idx: number; nombreSugerido: string } | null>(null)

  // Excel state
  const [itemsExcel, setItemsExcel] = useState<ItemExcel[]>([])

  const fileInputXML = useRef<HTMLInputElement>(null)
  const fileInputExcel = useRef<HTMLInputElement>(null)

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  // Cargar catálogo de productos
  const cargarProductos = useCallback(async () => {
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, codigo_barras, stock_actual')
      .eq('establecimiento_id', establecimientoId)
      .eq('visible_en_catalogo', true)
      .order('nombre')
    setProductos(data ?? [])
  }, [establecimientoId])

  useEffect(() => { cargarProductos() }, [cargarProductos])

  // ─── Parser XML ──────────────────────────────────────────
  const parsearXML = useCallback(async (file: File) => {
    setProcesando(true)
    setMensaje(null)
    try {
      const texto = await file.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(texto, 'text/xml')

      const autorizacion =
        doc.querySelector('numeroAutorizacion')?.textContent?.trim() ??
        doc.querySelector('claveAcceso')?.textContent?.trim() ?? ''

      if (!autorizacion) {
        setMensaje({ texto: 'No se encontró número de autorización en el XML', tipo: 'error' })
        setProcesando(false)
        return
      }

      // Verificar duplicado
      const { data: existente } = await supabase
        .from('ingresos_inventario')
        .select('id')
        .eq('numero_autorizacion', autorizacion)
        .maybeSingle()

      if (existente) {
        setMensaje({ texto: `⚠️ Esta factura ya fue procesada (…${autorizacion.slice(-12)})`, tipo: 'error' })
        setProcesando(false)
        return
      }

      const rucProveedor =
        doc.querySelector('infoTributaria > ruc')?.textContent?.trim() ??
        doc.querySelector('ruc')?.textContent?.trim() ?? ''
      const nombreProveedor =
        doc.querySelector('infoTributaria > razonSocial')?.textContent?.trim() ??
        doc.querySelector('razonSocial')?.textContent?.trim() ?? 'Proveedor'
      const fechaEmision =
        doc.querySelector('infoFactura > fechaEmision')?.textContent?.trim() ??
        doc.querySelector('fechaEmision')?.textContent?.trim() ??
        new Date().toLocaleDateString('es-EC')

      setMetaXML({ ruc: rucProveedor, nombre: nombreProveedor, autorizacion, fecha: fechaEmision })

      // Extraer detalles
      const detallesSet = new Set<Element>()
      doc.querySelectorAll('detalles > detalle').forEach(el => detallesSet.add(el))
      doc.querySelectorAll('detalle').forEach(el => detallesSet.add(el))
      const detalles = Array.from(detallesSet)

      if (detalles.length === 0) {
        setMensaje({ texto: 'No se encontraron ítems en el XML', tipo: 'error' })
        setProcesando(false)
        return
      }

      // Buscar equivalencias guardadas para este proveedor
      const { data: mapeos } = await supabase
        .from('proveedor_codigos_mapeo')
        .select('codigo_xml, producto_id, productos(nombre)')
        .eq('establecimiento_id', establecimientoId)
        .eq('ruc_proveedor', rucProveedor)
      const mapaEquivalencias = new Map(
        (mapeos ?? []).map(m => [m.codigo_xml, { id: m.producto_id, nombre: (m.productos as any)?.nombre ?? '' }])
      )

      const items: ItemXML[] = detalles.map(d => {
        const codigoXML = d.querySelector('codigoPrincipal')?.textContent?.trim() ?? ''
        const equivalencia = mapaEquivalencias.get(codigoXML)
        return {
          nombre: d.querySelector('descripcion')?.textContent?.trim() ?? 'Sin nombre',
          cantidad: parseFloat(d.querySelector('cantidad')?.textContent ?? '1'),
          precioUnitario: parseFloat(d.querySelector('precioUnitario')?.textContent ?? '0'),
          codigoXML,
          productoId: equivalencia?.id ?? null,
          productoNombre: equivalencia?.nombre ?? null,
          mapeadoAutomatico: !!equivalencia,
        }
      })

      setItemsXML(items)
      setVista('mapeo_xml')
    } catch {
      setMensaje({ texto: 'Error al leer el archivo XML', tipo: 'error' })
    }
    setProcesando(false)
  }, [establecimientoId])

  // ─── Actualizar item XML ──────────────────────────────────
  const actualizarItem = (idx: number, campo: keyof ItemXML, valor: any) => {
    setItemsXML(prev => prev.map((item, i) => i === idx ? { ...item, [campo]: valor } : item))
  }

  // ─── Confirmar ingreso XML ────────────────────────────────
  const confirmarXML = async () => {
    const sinVincular = itemsXML.filter(i => !i.productoId)
    if (sinVincular.length > 0) {
      setMensaje({ texto: `⚠️ ${sinVincular.length} ítem(s) sin vincular a un producto. Asígnalos o créalos antes de confirmar.`, tipo: 'error' })
      return
    }
    setConfirmando(true)
    try {
      for (const item of itemsXML) {
        // Guardar lote
        await supabase.from('lotes_productos').insert({
          producto_id: item.productoId,
          sucursal_id: 1,
          stock_lote: item.cantidad,
          precio_compra: item.precioUnitario,
          precio_venta_sugerido: parseFloat((item.precioUnitario * 1.3).toFixed(2)),
        })

        // Actualizar stock_actual
        const { data: lotes } = await supabase
          .from('lotes_productos')
          .select('stock_lote')
          .eq('producto_id', item.productoId)
        const nuevoStock = (lotes ?? []).reduce((s, l) => s + l.stock_lote, 0)
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', item.productoId)

        // Guardar equivalencia para futuras facturas
        if (item.codigoXML && metaXML) {
          await supabase.from('proveedor_codigos_mapeo').upsert({
            establecimiento_id: establecimientoId,
            ruc_proveedor: metaXML.ruc,
            codigo_xml: item.codigoXML,
            producto_id: item.productoId,
          }, { onConflict: 'establecimiento_id,ruc_proveedor,codigo_xml' })
        }
      }

      // Registrar ingreso
      await supabase.from('ingresos_inventario').insert({
        establecimiento_id: establecimientoId,
        numero_autorizacion: metaXML!.autorizacion,
        ruc_proveedor: metaXML!.ruc,
        nombre_proveedor: metaXML!.nombre,
        fecha_ingreso: new Date().toISOString().slice(0, 10),
        total_items: itemsXML.length,
        total_costo: itemsXML.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0),
      })

      setMensaje({ texto: `✅ ${itemsXML.length} ítems ingresados y equivalencias guardadas`, tipo: 'ok' })
      setVista('inicio')
      setItemsXML([])
      setMetaXML(null)
      cargarProductos()
    } catch {
      setMensaje({ texto: 'Error al confirmar el ingreso', tipo: 'error' })
    }
    setConfirmando(false)
  }

  // ─── Parser Excel ─────────────────────────────────────────
  const parsearExcel = useCallback(async (file: File) => {
    setProcesando(true)
    setMensaje(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const items: ItemExcel[] = []
      for (const row of rows) {
        const codigoBarras = String(row.codigo_barras ?? row['Código de Barras'] ?? row.codigo ?? '').trim()
        const nombre = String(row.nombre ?? row.Nombre ?? '').trim()
        const cantidad = parseInt(String(row.cantidad ?? 1)) || 1
        const precioCompra = parseFloat(String(row.precio_compra ?? 0).replace(',', '.')) || 0
        const precioVenta = parseFloat(String(row.precio_venta ?? 0).replace(',', '.')) || null

        if (!nombre && !codigoBarras) continue

        let productoExistente = null
        if (codigoBarras) {
          const { data } = await supabase
            .from('productos')
            .select('id, nombre, stock_actual')
            .eq('establecimiento_id', establecimientoId)
            .eq('codigo_barras', codigoBarras)
            .maybeSingle()
          productoExistente = data
        }

        items.push({ nombre: nombre || productoExistente?.nombre || 'Sin nombre', codigoBarras, cantidad, precioCompra, precioVenta, productoExistente })
      }

      setItemsExcel(items)
      setVista('preview_excel')
    } catch {
      setMensaje({ texto: 'Error al leer el archivo Excel', tipo: 'error' })
    }
    setProcesando(false)
  }, [establecimientoId])

  // ─── Confirmar Excel ──────────────────────────────────────
  const confirmarExcel = async () => {
    setConfirmando(true)
    try {
      for (const item of itemsExcel) {
        if (item.productoExistente) {
          await supabase.from('lotes_productos').insert({
            producto_id: item.productoExistente.id,
            sucursal_id: 1,
            stock_lote: item.cantidad,
            precio_compra: item.precioCompra || 0,
            precio_venta_sugerido: item.precioVenta ?? parseFloat((item.precioCompra * 1.3).toFixed(2)),
          })
          const nuevoStock = item.productoExistente.stock_actual + item.cantidad
          await supabase.from('productos').update({
            stock_actual: nuevoStock,
            precio_costo: item.precioCompra || undefined,
          }).eq('id', item.productoExistente.id)
        } else {
          const { data: nuevo } = await supabase.from('productos').insert({
            establecimiento_id: establecimientoId,
            nombre: item.nombre,
            codigo_barras: item.codigoBarras || null,
            precio_venta: item.precioVenta ?? parseFloat((item.precioCompra * 1.3).toFixed(2)),
            precio_costo: item.precioCompra || null,
            stock_actual: item.cantidad,
            visible_en_catalogo: true,
          }).select().single()
          if (nuevo) {
            await supabase.from('lotes_productos').insert({
              producto_id: nuevo.id,
              sucursal_id: 1,
              stock_lote: item.cantidad,
              precio_compra: item.precioCompra || 0,
              precio_venta_sugerido: item.precioVenta ?? parseFloat((item.precioCompra * 1.3).toFixed(2)),
            })
          }
        }
      }
      setMensaje({ texto: `✅ ${itemsExcel.length} productos procesados correctamente`, tipo: 'ok' })
      setVista('inicio')
      setItemsExcel([])
      cargarProductos()
    } catch {
      setMensaje({ texto: 'Error al confirmar el ingreso', tipo: 'error' })
    }
    setConfirmando(false)
  }

  const descargarPlantilla = async () => {
    const XLSX = await import('xlsx')
    const datos = [
      { nombre: 'Coca Cola 600ml', codigo_barras: '7891234567890', cantidad: 100, precio_compra: 0.50, precio_venta: 0.75 },
      { nombre: 'Pan de molde', codigo_barras: '', cantidad: 50, precio_compra: 1.20, precio_venta: 1.50 },
    ]
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    XLSX.writeFile(wb, 'plantilla_ingreso_inventario.xlsx')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.name.endsWith('.xml')) parsearXML(file)
    else if (file.name.match(/\.(xlsx|xls|csv)$/)) parsearExcel(file)
    else setMensaje({ texto: 'Solo se aceptan .xml, .xlsx, .xls o .csv', tipo: 'error' })
  }

  // ─── Estilos ──────────────────────────────────────────────
  const card = 'rounded-2xl bg-zinc-900 border border-zinc-800 p-5'
  const btnPrimary = 'rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors'
  const btnSecondary = 'rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-700 transition-colors'

  return (
    <div className="space-y-5 text-zinc-100">

      {mensaje && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
          mensaje.tipo === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          mensaje.tipo === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>
          {mensaje.texto}
          <button onClick={() => setMensaje(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── INICIO ── */}
      {vista === 'inicio' && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-white mb-1">📥 Ingreso de Inventario</h2>
          <p className="text-xs text-zinc-500 mb-5">Carga una factura XML del SRI o sube un Excel para actualizar el stock masivamente.</p>
          <div
            onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
              arrastrando ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-500'
            }`}
            onClick={() => fileInputXML.current?.click()}
          >
            <div className="text-4xl mb-3">{procesando ? '⏳' : '📂'}</div>
            <p className="text-sm font-medium text-zinc-300">
              {procesando ? 'Procesando archivo…' : 'Arrastra un archivo aquí o toca para seleccionar'}
            </p>
            <p className="text-xs text-zinc-600 mt-1">Factura XML del SRI · Excel · CSV</p>
            <input ref={fileInputXML} type="file" accept=".xml,.xlsx,.xls,.csv" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.name.endsWith('.xml')) parsearXML(file)
                else parsearExcel(file)
                e.target.value = ''
              }} />
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            <button onClick={() => fileInputXML.current?.click()} className={btnSecondary}>📄 Subir XML del SRI</button>
            <button onClick={() => fileInputExcel.current?.click()} className={btnSecondary}>📊 Subir Excel</button>
            <button onClick={descargarPlantilla} className={btnSecondary}>⬇️ Plantilla Excel</button>
            <input ref={fileInputExcel} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) parsearExcel(file)
                e.target.value = ''
              }} />
          </div>
        </div>
      )}

      {/* ── MAPEO XML ── */}
      {vista === 'mapeo_xml' && metaXML && (
        <div className="space-y-4">
          <div className={card}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white">📄 {metaXML.nombre}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">RUC {metaXML.ruc} · {metaXML.fecha}</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">Auth: …{metaXML.autorizacion.slice(-12)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">{itemsXML.length} ítems</p>
                <p className="text-sm font-bold text-white mt-1">
                  {fmt(itemsXML.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0))} total
                </p>
              </div>
            </div>
          </div>

          {/* Alerta si hay sin vincular */}
          {itemsXML.some(i => !i.productoId) && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
              ⚠️ {itemsXML.filter(i => !i.productoId).length} ítem(s) sin vincular — busca el producto en el catálogo o créalo nuevo.
            </div>
          )}

          <div className={`${card} p-0 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Vincula cada ítem a un producto del catálogo</h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {itemsXML.map((item, i) => (
                <div key={i} className="px-4 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{item.nombre}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">Código XML: {item.codigoXML || '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-zinc-400">{fmt(item.precioUnitario)} × </p>
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={e => actualizarItem(i, 'cantidad', parseFloat(e.target.value) || 1)}
                        className="w-16 text-right rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-indigo-500"
                      />
                      <p className="text-xs text-white font-bold mt-0.5">{fmt(item.precioUnitario * item.cantidad)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.mapeadoAutomatico && (
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                        🔗 Auto
                      </span>
                    )}
                    <div className="flex-1">
                      <SelectorProducto
                        productos={productos}
                        valorActual={item.productoId}
                        onChange={(id, nombre) => {
                          actualizarItem(i, 'productoId', id)
                          actualizarItem(i, 'productoNombre', nombre)
                        }}
                        placeholder="Buscar en catálogo…"
                      />
                    </div>
                    {!item.productoId && (
                      <button
                        type="button"
                        onClick={() => setModalCrear({ idx: i, nombreSugerido: item.nombre })}
                        className="flex-shrink-0 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        ➕ Crear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setVista('inicio'); setItemsXML([]); setMetaXML(null) }} className={btnSecondary}>
              ← Cancelar
            </button>
            <button
              onClick={confirmarXML}
              disabled={confirmando || itemsXML.some(i => !i.productoId)}
              className={btnPrimary}
            >
              {confirmando ? 'Procesando…' : `✅ Confirmar ${itemsXML.length} ítems`}
            </button>
          </div>
        </div>
      )}

      {/* ── PREVIEW EXCEL ── */}
      {vista === 'preview_excel' && (
        <div className="space-y-4">
          <div className={`${card} p-0 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">📊 Previsualización Excel</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {itemsExcel.filter(i => i.productoExistente).length} existentes ·{' '}
                  {itemsExcel.filter(i => !i.productoExistente).length} nuevos
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full">✓ Suma stock</span>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-full">+ Crea producto</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Cant.</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Costo</th>
                    <th className="px-4 py-3 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsExcel.map((item, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <p className="text-zinc-200 text-xs font-medium">{item.nombre}</p>
                        {item.productoExistente && (
                          <p className="text-zinc-600 text-[10px]">Stock actual: {item.productoExistente.stock_actual}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-zinc-300 hidden sm:table-cell">{item.precioCompra ? fmt(item.precioCompra) : '—'}</td>
                      <td className="px-4 py-3">
                        {item.productoExistente
                          ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">+{item.cantidad} uds</span>
                          : <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">Crear nuevo</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setVista('inicio'); setItemsExcel([]) }} className={btnSecondary}>← Cancelar</button>
            <button onClick={confirmarExcel} disabled={confirmando} className={btnPrimary}>
              {confirmando ? 'Procesando…' : `✅ Confirmar ${itemsExcel.length} productos`}
            </button>
          </div>
        </div>
      )}

      {/* Modal crear producto */}
      {modalCrear && (
        <ModalCrearProducto
          nombreSugerido={modalCrear.nombreSugerido}
          establecimientoId={establecimientoId}
          onCreado={(nuevoProducto) => {
            actualizarItem(modalCrear.idx, 'productoId', nuevoProducto.id)
            actualizarItem(modalCrear.idx, 'productoNombre', nuevoProducto.nombre)
            setProductos(prev => [...prev, nuevoProducto].sort((a, b) => a.nombre.localeCompare(b.nombre)))
            setModalCrear(null)
          }}
          onCerrar={() => setModalCrear(null)}
        />
      )}
    </div>
  )
}