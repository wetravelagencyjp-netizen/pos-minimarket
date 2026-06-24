'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────
interface ItemXML {
  nombre: string
  cantidad: number
  precioUnitario: number
  codigoBarras?: string
  productoId?: number | null
  sucursalId: number
}

interface ItemExcel {
  nombre: string
  codigoBarras: string
  cantidad: number
  precioCompra: number
  precioVenta: number | null
  productoExistente?: { id: number; nombre: string; stock_actual: number } | null
}

type Vista = 'inicio' | 'mapeo_xml' | 'preview_excel'

export default function IngresoInventarioInteligente({ establecimientoId }: { establecimientoId: number }) {
  const [vista, setVista] = useState<Vista>('inicio')
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info' } | null>(null)

  // XML state
  const [itemsXML, setItemsXML] = useState<ItemXML[]>([])
  const [metaXML, setMetaXML] = useState<{ ruc: string; nombre: string; autorizacion: string; fecha: string } | null>(null)

  // Excel state
  const [itemsExcel, setItemsExcel] = useState<ItemExcel[]>([])

  const fileInputXML = useRef<HTMLInputElement>(null)
  const fileInputExcel = useRef<HTMLInputElement>(null)

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

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
        setMensaje({ texto: `⚠️ Esta factura ya fue procesada anteriormente (autorización: ${autorizacion.slice(-10)})`, tipo: 'error' })
        setProcesando(false)
        return
      }

      const rucProveedor =
        doc.querySelector('rucEmisor')?.textContent?.trim() ??
        doc.querySelector('identificacionComprador')?.textContent?.trim() ?? ''
      const nombreProveedor =
        doc.querySelector('razonSocialEmisor')?.textContent?.trim() ??
        doc.querySelector('razonSocialComprador')?.textContent?.trim() ?? 'Proveedor'
      const fechaEmision =
        doc.querySelector('fechaEmision')?.textContent?.trim() ??
        new Date().toLocaleDateString('es-EC')

      setMetaXML({ ruc: rucProveedor, nombre: nombreProveedor, autorizacion, fecha: fechaEmision })

      // Extraer detalles
      const detalles = Array.from(doc.querySelectorAll('detalle'))
      if (detalles.length === 0) {
        setMensaje({ texto: 'No se encontraron ítems en el XML', tipo: 'error' })
        setProcesando(false)
        return
      }

      const items: ItemXML[] = detalles.map(d => ({
        nombre: d.querySelector('descripcion')?.textContent?.trim() ?? 'Producto sin nombre',
        cantidad: parseFloat(d.querySelector('cantidad')?.textContent ?? '1'),
        precioUnitario: parseFloat(d.querySelector('precioUnitario')?.textContent ?? '0'),
        codigoBarras: d.querySelector('codigoPrincipal')?.textContent?.trim() ?? undefined,
        productoId: null,
        sucursalId: 1,
      }))

      // Intentar match con productos existentes por código de barras
      const codigos = items.map(i => i.codigoBarras).filter(Boolean) as string[]
      if (codigos.length > 0) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, codigo_barras')
          .eq('establecimiento_id', establecimientoId)
          .in('codigo_barras', codigos)
        if (productos) {
          const mapaProductos = new Map(productos.map(p => [p.codigo_barras, p]))
          items.forEach(item => {
            if (item.codigoBarras) {
              const match = mapaProductos.get(item.codigoBarras)
              if (match) item.productoId = match.id
            }
          })
        }
      }

      setItemsXML(items)
      setVista('mapeo_xml')
    } catch (err) {
      setMensaje({ texto: 'Error al leer el archivo XML', tipo: 'error' })
    }
    setProcesando(false)
  }, [establecimientoId])

  // ─── Confirmar ingreso XML ────────────────────────────────
  const confirmarXML = async () => {
    if (!metaXML) return
    setConfirmando(true)
    try {
      for (const item of itemsXML) {
        await supabase.from('lotes_productos').insert({
          producto_id: item.productoId ?? null,
          sucursal_id: item.sucursalId,
          stock_lote: item.cantidad,
          precio_compra: item.precioUnitario,
          precio_venta_sugerido: item.precioUnitario * 1.3,
        })

        if (item.productoId) {
          await supabase.rpc('ajustar_saldo_cuenta', {
            p_cuenta_id: 1,
            p_nuevo_saldo: 0,
            p_motivo: 'placeholder',
          }).then(() => {}) // solo para no dejar sin catch

          // Actualizar stock_actual
          const { data: lotes } = await supabase
            .from('lotes_productos')
            .select('stock_lote')
            .eq('producto_id', item.productoId)
          const nuevoStock = (lotes ?? []).reduce((s, l) => s + l.stock_lote, 0)
          await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', item.productoId)
        }
      }

      await supabase.from('ingresos_inventario').insert({
        establecimiento_id: establecimientoId,
        numero_autorizacion: metaXML.autorizacion,
        ruc_proveedor: metaXML.ruc,
        nombre_proveedor: metaXML.nombre,
        fecha_ingreso: new Date().toISOString().slice(0, 10),
        total_items: itemsXML.length,
        total_costo: itemsXML.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0),
      })

      setMensaje({ texto: `✅ ${itemsXML.length} ítems ingresados correctamente`, tipo: 'ok' })
      setVista('inicio')
      setItemsXML([])
      setMetaXML(null)
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
        const cantidad = parseInt(String(row.cantidad ?? row.Cantidad ?? 1)) || 1
        const precioCompra = parseFloat(String(row.precio_compra ?? row['Precio Costo'] ?? 0).replace(',', '.')) || 0
        const precioVenta = parseFloat(String(row.precio_venta ?? row['Precio Venta'] ?? 0).replace(',', '.')) || null

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
          // Producto existe → nuevo lote
          await supabase.from('lotes_productos').insert({
            producto_id: item.productoExistente.id,
            sucursal_id: 1,
            stock_lote: item.cantidad,
            precio_compra: item.precioCompra || 0,
            precio_venta_sugerido: item.precioVenta ?? item.precioCompra * 1.3,
          })
          const nuevoStock = item.productoExistente.stock_actual + item.cantidad
          await supabase.from('productos').update({
            stock_actual: nuevoStock,
            precio_costo: item.precioCompra || undefined,
          }).eq('id', item.productoExistente.id)
        } else {
          // Producto nuevo → crear + lote
          const { data: nuevo } = await supabase.from('productos').insert({
            establecimiento_id: establecimientoId,
            nombre: item.nombre,
            codigo_barras: item.codigoBarras || null,
            precio_venta: item.precioVenta ?? item.precioCompra * 1.3,
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
              precio_venta_sugerido: item.precioVenta ?? item.precioCompra * 1.3,
            })
          }
        }
      }
      setMensaje({ texto: `✅ ${itemsExcel.length} productos procesados correctamente`, tipo: 'ok' })
      setVista('inicio')
      setItemsExcel([])
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
    else setMensaje({ texto: 'Solo se aceptan archivos .xml, .xlsx, .xls o .csv', tipo: 'error' })
  }

  // ─── UI ───────────────────────────────────────────────────
  const card = 'rounded-2xl bg-zinc-900 border border-zinc-800 p-5'
  const inputCls = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'
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
        <div className="space-y-4">
          <div className={card}>
            <h2 className="text-sm font-semibold text-white mb-1">📥 Ingreso de Inventario</h2>
            <p className="text-xs text-zinc-500 mb-5">Carga una factura XML del SRI o sube un Excel para actualizar el stock masivamente.</p>

            {/* Zona Drag & Drop */}
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
              <button onClick={() => fileInputXML.current?.click()} className={btnSecondary}>
                📄 Subir XML del SRI
              </button>
              <button onClick={() => fileInputExcel.current?.click()} className={btnSecondary}>
                📊 Subir Excel
              </button>
              <button onClick={descargarPlantilla} className={btnSecondary}>
                ⬇️ Descargar plantilla Excel
              </button>
              <input ref={fileInputExcel} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) parsearExcel(file)
                  e.target.value = ''
                }} />
            </div>
          </div>
        </div>
      )}

      {/* ── MAPEO XML ── */}
      {vista === 'mapeo_xml' && metaXML && (
        <div className="space-y-4">
          <div className={card}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white">📄 Factura del SRI</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{metaXML.nombre} · RUC {metaXML.ruc}</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">Auth: …{metaXML.autorizacion.slice(-12)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Fecha: {metaXML.fecha}</p>
                <p className="text-xs text-zinc-500">{itemsXML.length} ítems</p>
                <p className="text-sm font-bold text-white mt-1">
                  {fmt(itemsXML.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0))} total
                </p>
              </div>
            </div>
          </div>

          <div className={`${card} p-0 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Mapeo de ítems — asigna sucursal a cada producto</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Los ítems en verde ya existen en tu catálogo.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Cant.</th>
                    <th className="px-4 py-3 text-right">Costo u.</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsXML.map((item, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <p className="text-zinc-200 text-xs font-medium">{item.nombre}</p>
                        {item.codigoBarras && <p className="text-zinc-600 text-[10px] font-mono">{item.codigoBarras}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{fmt(item.precioUnitario)}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{fmt(item.precioUnitario * item.cantidad)}</td>
                      <td className="px-4 py-3">
                        {item.productoId
                          ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">✓ En catálogo</span>
                          : <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">Nuevo</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setVista('inicio'); setItemsXML([]); setMetaXML(null) }} className={btnSecondary}>
              ← Cancelar
            </button>
            <button onClick={confirmarXML} disabled={confirmando} className={btnPrimary}>
              {confirmando ? 'Procesando…' : `✅ Confirmar ingreso de ${itemsXML.length} ítems`}
            </button>
          </div>
        </div>
      )}

      {/* ── PREVIEW EXCEL ── */}
      {vista === 'preview_excel' && (
        <div className="space-y-4">
          <div className={`${card} p-0 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
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
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Código</th>
                    <th className="px-4 py-3 text-right">Cant.</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Costo</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Venta</th>
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
                      <td className="px-4 py-3 text-right text-zinc-500 text-xs font-mono hidden sm:table-cell">{item.codigoBarras || '—'}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-zinc-300 hidden sm:table-cell">{item.precioCompra ? fmt(item.precioCompra) : '—'}</td>
                      <td className="px-4 py-3 text-right text-zinc-300 hidden sm:table-cell">{item.precioVenta ? fmt(item.precioVenta) : '—'}</td>
                      <td className="px-4 py-3">
                        {item.productoExistente
                          ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              +{item.cantidad} uds
                            </span>
                          : <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                              Crear nuevo
                            </span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setVista('inicio'); setItemsExcel([]) }} className={btnSecondary}>
              ← Cancelar
            </button>
            <button onClick={confirmarExcel} disabled={confirmando} className={btnPrimary}>
              {confirmando ? 'Procesando…' : `✅ Confirmar ${itemsExcel.length} productos`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}