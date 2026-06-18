'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Seccion = 'productos' | 'vendedores' | 'categorias' | 'equipo' | 'reportes'

export default function AdminPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<Seccion>('productos')

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pos')} className="text-xs text-gray-400 hover:text-gray-600">← Volver al POS</button>
          <h1 className="text-sm font-semibold text-gray-900">Panel de Administración</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/facturacion')} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-100">🧾 Facturación SRI</button>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 border-r border-gray-100 bg-white p-4 space-y-1">
          {[
            { id: 'productos', label: '📦 Productos' },
            { id: 'vendedores', label: '👤 Vendedores' },
            { id: 'categorias', label: '🏷️ Categorías' },
            { id: 'equipo', label: '👥 Mi equipo' },
            { id: 'reportes', label: '📊 Reportes' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setSeccion(id as Seccion)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors
                ${seccion === id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
          <div className="my-2 border-t border-gray-100" />
          <button onClick={() => router.push('/admin/gastos')}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            💸 Gastos
          </button>
          <button onClick={() => router.push('/admin/finanzas')}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            📊 Finanzas
          </button>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {seccion === 'productos' && <SeccionProductos establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'vendedores' && <SeccionVendedores establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'categorias' && <SeccionCategorias establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'equipo' && <SeccionEquipo establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'reportes' && <SeccionReportes establecimientoId={usuario?.establecimiento_id ?? 1} />}
        </main>
      </div>
    </div>
  )
}

// ─── PRODUCTOS (con importador Excel) ──────────────────────
function SeccionProductos({ establecimientoId }: { establecimientoId: number }) {
  const { usuario } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', precio_costo: '', precio_venta: '', stock_actual: '', vendedor_id: '', categoria_id: '', codigo_barras: '', imagen_url: '', visible_en_catalogo: true })
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mostrarImportador, setMostrarImportador] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [loteParaProducto, setLoteParaProducto] = useState<any | null>(null)
  const [margenDefecto, setMargenDefecto] = useState('')
  const [guardandoMargen, setGuardandoMargen] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [p, v, c] = await Promise.all([
      supabase.from('productos').select('*, vendedor:vendedores(nombre), categoria:categorias(nombre)').eq('establecimiento_id', establecimientoId).order('nombre'),
      supabase.from('vendedores').select('*').eq('establecimiento_id', establecimientoId),
      supabase.from('categorias').select('*').eq('establecimiento_id', establecimientoId),
    ])
    setProductos(p.data ?? [])
    setVendedores(v.data ?? [])
    setCategorias(c.data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => {
    supabase.from('establecimientos').select('margen_costo_estimado').eq('id', establecimientoId).single()
      .then(({ data }) => setMargenDefecto(data?.margen_costo_estimado != null ? String(data.margen_costo_estimado) : ''))
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const limpiarForm = () => setForm({ nombre: '', precio_costo: '', precio_venta: '', stock_actual: '', vendedor_id: '', categoria_id: '', codigo_barras: '', imagen_url: '', visible_en_catalogo: true })
  const guardarMargen = async () => {
    setGuardandoMargen(true)
    await supabase.from('establecimientos').update({ margen_costo_estimado: parseFloat(margenDefecto) || 0 }).eq('id', establecimientoId)
    setGuardandoMargen(false)
  }

  const subirImagen = async (file: File) => {
    setSubiendoImagen(true)
    const ext = file.name.split('.').pop()
    const nombreArchivo = `${establecimientoId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('productos').upload(nombreArchivo, file)
    if (error) {
      alert('Error subiendo la foto: ' + error.message)
      setSubiendoImagen(false)
      return
    }
    const { data } = supabase.storage.from('productos').getPublicUrl(nombreArchivo)
    setForm(f => ({ ...f, imagen_url: data.publicUrl }))
    setSubiendoImagen(false)
  }

  const handleArchivoImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) subirImagen(file)
  }

  const guardar = async () => {
    if (!form.nombre || !form.precio_venta) return
    setGuardando(true)
    const datos = {
      establecimiento_id: establecimientoId,
      nombre: form.nombre,
      precio_costo: form.precio_costo ? parseFloat(form.precio_costo) : null,
      precio_venta: parseFloat(form.precio_venta),
      stock_actual: parseInt(form.stock_actual) || 0,
      vendedor_id: form.vendedor_id ? parseInt(form.vendedor_id) : null,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      codigo_barras: form.codigo_barras || null,
      imagen_url: form.imagen_url || null,
      visible_en_catalogo: form.visible_en_catalogo,
    }
    if (editando) {
      await supabase.from('productos').update(datos).eq('id', editando)
    } else {
      await supabase.from('productos').insert(datos)
    }
    setGuardando(false)
    setEditando(null)
    limpiarForm()
    cargar()
  }

  const editar = (p: any) => {
    setEditando(p.id)
    setForm({ nombre: p.nombre, precio_costo: p.precio_costo != null ? String(p.precio_costo) : '', precio_venta: String(p.precio_venta), stock_actual: String(p.stock_actual), vendedor_id: String(p.vendedor_id ?? ''), categoria_id: String(p.categoria_id ?? ''), codigo_barras: p.codigo_barras ?? '', imagen_url: p.imagen_url ?? '', visible_en_catalogo: p.visible_en_catalogo ?? true })
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    cargar()
  }

  const exportarInventario = async () => {
    const XLSX = await import('xlsx')
    const filas = productos.map(p => ({
      'Código de Barra': p.codigo_barras || '',
      'Nombre del Producto': p.nombre,
      'Categoría': p.categoria?.nombre ?? '',
      'Vendedor': p.vendedor?.nombre ?? '',
      'Precio de Costo': p.precio_costo ?? '',
      'Precio de Venta': p.precio_venta,
      'Stock Actual': p.stock_actual,
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    const nombreTienda = (usuario?.establecimiento?.nombre ?? 'tienda').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `inventario_${nombreTienda}_${fecha}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">⚙️ Margen de ganancia por defecto</h2>
        <p className="mb-3 text-xs text-gray-500">Se usa para sugerir el precio de venta cuando recibes stock de un producto por primera vez.</p>
        <div className="flex items-center gap-3">
          <div className="relative max-w-[160px]">
            <input type="number" value={margenDefecto} onChange={e => setMargenDefecto(e.target.value)}
              placeholder="ej: 50"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-7 text-sm outline-none focus:border-blue-400" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
          <button onClick={guardarMargen} disabled={guardandoMargen}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardandoMargen ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{editando ? '✏️ Editar producto' : '➕ Nuevo producto'}</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportarInventario}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
              📥 Exportar Inventario
            </button>
            <button onClick={() => setMostrarImportador(true)}
              className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
              📊 Importar desde Excel
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {form.imagen_url ? (
                <img src={form.imagen_url} alt="Foto del producto" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl text-gray-300">📦</span>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleArchivoImagen} className="hidden" id="imagen-producto" />
            <label htmlFor="imagen-producto"
              className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors">
              {subiendoImagen ? 'Subiendo…' : form.imagen_url ? 'Cambiar foto' : '📷 Subir foto'}
            </label>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            <input placeholder="Nombre del producto *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <input placeholder="Código de barras" value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <input placeholder="Precio de costo" type="number" value={form.precio_costo} onChange={e => setForm(f => ({ ...f, precio_costo: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <input placeholder="Precio de venta *" type="number" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <input placeholder="Stock actual" type="number" value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <select value={form.vendedor_id} onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="">— Seleccionar vendedor —</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
            <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="">— Seleccionar categoría —</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.visible_en_catalogo} onChange={e => setForm(f => ({ ...f, visible_en_catalogo: e.target.checked }))}
                className="rounded border-gray-300" />
              🛍️ Mostrar en catálogo web
            </label>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={guardar} disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar producto'}
          </button>
          {editando && <button onClick={() => { setEditando(null); limpiarForm() }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancelar</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Productos ({productos.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Foto</th>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Vendedor</th>
                <th className="px-5 py-3 text-left">Categoría</th>
                <th className="px-5 py-3 text-right">Precio</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-base">{p.categoria?.icono ?? '📦'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-5 py-3 text-gray-500">{p.vendedor?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{p.categoria?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-right">${p.precio_venta.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right">{p.stock_actual}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setLoteParaProducto(p)} className="mr-2 text-emerald-600 hover:text-emerald-700 text-xs">📦 Stock</button>
                    <button onClick={() => editar(p)} className="mr-2 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => eliminar(p.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mostrarImportador && (
        <ImportadorExcel
          establecimientoId={establecimientoId}
          vendedores={vendedores}
          categorias={categorias}
          onCerrar={() => setMostrarImportador(false)}
          onImportado={() => { setMostrarImportador(false); cargar() }}
        />
      )}

      {loteParaProducto && (
        <ModalNuevoLote
          producto={loteParaProducto}
          establecimientoId={establecimientoId}
          onCerrar={() => setLoteParaProducto(null)}
          onGuardado={() => { setLoteParaProducto(null); cargar() }}
        />
      )}
    </div>
  )
}// ─── IMPORTADOR EXCEL ──────────────────────────────────────
type FilaImportada = {
  nombre: string
  precio_venta: number | null
  stock_actual: number
  categoria_nombre: string
  codigo_barras: string
  vendedor_nombre: string
  error?: string
}

function ImportadorExcel({
  establecimientoId, vendedores, categorias, onCerrar, onImportado,
}: {
  establecimientoId: number
  vendedores: any[]
  categorias: any[]
  onCerrar: () => void
  onImportado: () => void
}) {
  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: number; errores: number } | null>(null)
  const [crearCategoriasFaltantes, setCrearCategoriasFaltantes] = useState(true)

  const descargarPlantilla = () => {
    import('xlsx').then(XLSX => {
      const datos = [
        { nombre: 'Coca Cola 600ml', precio_venta: 0.75, stock_actual: 100, categoria: 'Bebidas y Licores', codigo_barras: '7891234567890', vendedor: '' },
        { nombre: 'Pan de molde', precio_venta: 1.5, stock_actual: 50, categoria: 'Panadería', codigo_barras: '', vendedor: '' },
      ]
      const ws = XLSX.utils.json_to_sheet(datos)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Productos')
      XLSX.writeFile(wb, 'plantilla_productos.xlsx')
    })
  }

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoNombre(file.name)
    setProcesando(true)
    setResultado(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = await import('xlsx')
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const parsed: FilaImportada[] = rows.map(row => {
          const nombre = String(row.nombre ?? row.Nombre ?? '').trim()
          const precioRaw = row.precio_venta ?? row.precio ?? row.Precio ?? row['Precio de venta']
          const precio = precioRaw !== '' && precioRaw !== undefined ? parseFloat(String(precioRaw).replace(',', '.')) : null
          const stockRaw = row.stock_actual ?? row.stock ?? row.Stock ?? 0
          const stock = parseInt(String(stockRaw)) || 0
          const categoria_nombre = String(row.categoria ?? row.Categoria ?? row['Categoría'] ?? '').trim()
          const codigo_barras = String(row.codigo_barras ?? row['código de barras'] ?? row['Código de barras'] ?? '').trim()
          const vendedor_nombre = String(row.vendedor ?? row.Vendedor ?? '').trim()

          let error: string | undefined
          if (!nombre) error = 'Falta el nombre'
          else if (precio === null || isNaN(precio) || precio <= 0) error = 'Precio inválido'

          return { nombre, precio_venta: precio, stock_actual: stock, categoria_nombre, codigo_barras, vendedor_nombre, error }
        }).filter(f => f.nombre || f.precio_venta !== null)

        setFilas(parsed)
      } catch {
        setFilas([])
        setResultado({ ok: 0, errores: 1 })
      }
      setProcesando(false)
    }
    reader.readAsBinaryString(file)
  }

  const filasValidas = filas.filter(f => !f.error)
  const filasConError = filas.filter(f => f.error)

  const confirmarImportacion = async () => {
    setImportando(true)
    let ok = 0
    let errores = filasConError.length

    const catMap = new Map(categorias.map(c => [c.nombre.toLowerCase(), c.id]))
    const venMap = new Map(vendedores.map(v => [v.nombre.toLowerCase(), v.id]))

    if (crearCategoriasFaltantes) {
      const nombresFaltantes = Array.from(new Set(
        filasValidas
          .map(f => f.categoria_nombre)
          .filter(n => n && !catMap.has(n.toLowerCase()))
      ))
      for (const nombre of nombresFaltantes) {
        const { data } = await supabase.from('categorias')
          .insert({ nombre, establecimiento_id: establecimientoId, icono: '📦' })
          .select().single()
        if (data) catMap.set(nombre.toLowerCase(), data.id)
      }
    }

    const registros = filasValidas.map(f => ({
      establecimiento_id: establecimientoId,
      nombre: f.nombre,
      precio_venta: f.precio_venta,
      stock_actual: f.stock_actual,
      codigo_barras: f.codigo_barras || null,
      categoria_id: f.categoria_nombre ? catMap.get(f.categoria_nombre.toLowerCase()) ?? null : null,
      vendedor_id: f.vendedor_nombre ? venMap.get(f.vendedor_nombre.toLowerCase()) ?? null : null,
    }))

    if (registros.length > 0) {
      const { error } = await supabase.from('productos').insert(registros)
      if (error) { errores += registros.length } else { ok += registros.length }
    }

    setResultado({ ok, errores })
    setImportando(false)
    setTimeout(() => onImportado(), 1500)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">📊 Importar productos desde Excel</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {filas.length === 0 && (
            <>
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-3xl mb-3">📁</div>
                <p className="text-sm text-gray-600 mb-1">Sube tu archivo de productos</p>
                <p className="text-xs text-gray-400 mb-4">Formatos aceptados: .xlsx, .xls, .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleArchivo} className="hidden" id="excel-file" />
                <label htmlFor="excel-file"
                  className="cursor-pointer rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
                  {procesando ? '🔄 Leyendo archivo…' : '📁 Seleccionar archivo'}
                </label>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1.5">
                <p className="font-medium">📋 Columnas que reconoce el sistema:</p>
                <p><strong>nombre</strong> (obligatorio) · <strong>precio_venta</strong> (obligatorio) · stock_actual · categoria · codigo_barras · vendedor</p>
                <button onClick={descargarPlantilla} className="mt-2 text-blue-600 underline hover:text-blue-800">
                  ⬇️ Descargar plantilla de ejemplo
                </button>
              </div>
            </>
          )}

          {filas.length > 0 && !resultado && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{archivoNombre}</p>
                  <p className="text-xs text-gray-400">{filas.length} filas encontradas</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-1 font-medium">✓ {filasValidas.length} listas</span>
                  {filasConError.length > 0 && (
                    <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-1 font-medium">✗ {filasConError.length} con error</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                <input type="checkbox" id="crear-cats" checked={crearCategoriasFaltantes}
                  onChange={e => setCrearCategoriasFaltantes(e.target.checked)}
                  className="rounded border-gray-300" />
                <label htmlFor="crear-cats" className="text-xs text-gray-600">
                  Crear automáticamente las categorías que no existan todavía
                </label>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                      <th className="px-3 py-2 text-left">Categoría</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${f.error ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{f.nombre || '—'}</td>
                        <td className="px-3 py-2 text-right">{f.precio_venta !== null ? `$${f.precio_venta.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2 text-right">{f.stock_actual}</td>
                        <td className="px-3 py-2 text-gray-500">{f.categoria_nombre || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {f.error ? (
                            <span className="text-red-600 text-[11px]">{f.error}</span>
                          ) : (
                            <span className="text-green-600 text-[11px]">✓ OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setFilas([])}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Subir otro archivo
                </button>
                <button onClick={confirmarImportacion} disabled={importando || filasValidas.length === 0}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {importando ? 'Importando…' : `✅ Importar ${filasValidas.length} productos`}
                </button>
              </div>
            </>
          )}

          {resultado && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-sm font-medium text-gray-900">
                {resultado.ok} productos importados correctamente
              </p>
              {resultado.errores > 0 && (
                <p className="text-xs text-red-500 mt-1">{resultado.errores} filas con errores fueron omitidas</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── NUEVO LOTE (recibir mercancía) ────────────────────────
function ModalNuevoLote({
  producto, establecimientoId, onCerrar, onGuardado,
}: {
  producto: any
  establecimientoId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [cantidad, setCantidad] = useState('')
  const [precioCompra, setPrecioCompra] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [sinHistorial, setSinHistorial] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const costo = parseFloat(precioCompra)
    if (!costo || costo <= 0) return

    const sugerir = async () => {
      const { data: ultimoLote } = await supabase
        .from('lotes_productos')
        .select('precio_compra, precio_venta_sugerido')
        .eq('producto_id', producto.id)
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ultimoLote && ultimoLote.precio_compra > 0) {
        const markup = (ultimoLote.precio_venta_sugerido - ultimoLote.precio_compra) / ultimoLote.precio_compra
        setPrecioVenta((costo * (1 + markup)).toFixed(2))
        setSinHistorial(false)
      } else {
        const { data: estab } = await supabase
          .from('establecimientos')
          .select('margen_costo_estimado')
          .eq('id', establecimientoId)
          .single()
        const margen = estab?.margen_costo_estimado ?? 0
        setPrecioVenta((costo * (1 + margen / 100)).toFixed(2))
        setSinHistorial(true)
      }
    }
    sugerir()
  }, [precioCompra, producto.id, establecimientoId])

  const guardar = async () => {
    const cant = parseInt(cantidad)
    const costo = parseFloat(precioCompra)
    const venta = parseFloat(precioVenta)
    if (!cant || cant <= 0 || !costo || !venta) return
    setGuardando(true)

    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('id')
      .eq('establecimiento_id', establecimientoId)
      .limit(1)
      .maybeSingle()

    if (!sucursal) {
      alert('Falta crear una sucursal para este establecimiento')
      setGuardando(false)
      return
    }

    await supabase.from('lotes_productos').insert({
      producto_id: producto.id,
      sucursal_id: sucursal.id,
      precio_compra: costo,
      precio_venta_sugerido: venta,
      stock_lote: cant,
      margen_ganancia: +(((venta - costo) / costo) * 100).toFixed(2),
    })

    await supabase.from('productos').update({
      stock_actual: producto.stock_actual + cant,
      precio_costo: costo,
      precio_venta: venta,
    }).eq('id', producto.id)

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">📦 Recibir stock — {producto.nombre}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <input placeholder="Cantidad recibida *" type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />

        <input placeholder="Precio de costo de este lote *" type="number" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />

        <div>
          <input placeholder="Precio de venta sugerido" type="number" value={precioVenta} onChange={e => setPrecioVenta(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          {sinHistorial && precioVenta && (
            <p className="mt-1 text-[11px] text-amber-600">Sugerido con el margen por defecto del establecimiento — puedes ajustarlo.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Registrar lote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── VENDEDORES ────────────────────────────────────────────
function SeccionVendedores({ establecimientoId }: { establecimientoId: number }) {
  const [vendedores, setVendedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vendedores').select('*').eq('establecimiento_id', establecimientoId).order('nombre')
    setVendedores(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('vendedores').update({ nombre }).eq('id', editando)
    } else {
      await supabase.from('vendedores').insert({ nombre, establecimiento_id: establecimientoId })
    }
    setGuardando(false)
    setEditando(null)
    setNombre('')
    cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este vendedor?')) return
    await supabase.from('vendedores').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">{editando ? '✏️ Editar vendedor' : '➕ Nuevo vendedor'}</h2>
        <div className="flex gap-3">
          <input placeholder="Nombre completo *" value={nombre} onChange={e => setNombre(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <button onClick={guardar} disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar'}
          </button>
          {editando && <button onClick={() => { setEditando(null); setNombre('') }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500">Cancelar</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Vendedores ({vendedores.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map(v => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{v.nombre}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { setEditando(v.id); setNombre(v.nombre) }} className="mr-2 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => eliminar(v.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
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

// ─── CATEGORÍAS ────────────────────────────────────────────
function SeccionCategorias({ establecimientoId }: { establecimientoId: number }) {
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', icono: '' })
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('categorias').select('*').eq('establecimiento_id', establecimientoId).order('nombre')
    setCategorias(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('categorias').update(form).eq('id', editando)
    } else {
      await supabase.from('categorias').insert({ ...form, establecimiento_id: establecimientoId })
    }
    setGuardando(false)
    setEditando(null)
    setForm({ nombre: '', icono: '' })
    cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    await supabase.from('categorias').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">{editando ? '✏️ Editar categoría' : '➕ Nueva categoría'}</h2>
        <div className="flex gap-3">
          <input placeholder="Emoji (ej: 🛒)" value={form.icono} onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Nombre de la categoría *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <button onClick={guardar} disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar'}
          </button>
          {editando && <button onClick={() => { setEditando(null); setForm({ nombre: '', icono: '' }) }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500">Cancelar</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Categorías ({categorias.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Icono</th>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-xl">{c.icono ?? '—'}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{c.nombre}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { setEditando(c.id); setForm({ nombre: c.nombre, icono: c.icono ?? '' }) }} className="mr-2 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => eliminar(c.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
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

// ─── MI EQUIPO ────────────────────────────────────────────
function SeccionEquipo({ establecimientoId }: { establecimientoId: number }) {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'cajero' })
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('usuarios').select('*').eq('establecimiento_id', establecimientoId).order('nombre')
    setUsuarios(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const crearUsuario = async () => {
    if (!form.nombre || !form.email || !form.password) return
    setCreando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, establecimiento_id: establecimientoId }),
      })
      const data = await res.json()
      if (data.ok) {
        setMensaje({ texto: '✅ Usuario creado correctamente', tipo: 'ok' })
        setForm({ nombre: '', email: '', password: '', rol: 'cajero' })
        cargar()
      } else {
        setMensaje({ texto: `❌ Error: ${data.error}`, tipo: 'error' })
      }
    } catch {
      setMensaje({ texto: '❌ Error de conexión', tipo: 'error' })
    }
    setCreando(false)
  }

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    cargar()
  }

  const rolLabel: Record<string, string> = { admin: '👔 Admin', cajero: '🧾 Cajero' }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">➕ Agregar miembro del equipo</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Nombre completo *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Correo electrónico *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Contraseña *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="cajero">🧾 Cajero</option>
            <option value="admin">👔 Admin</option>
          </select>
        </div>
        {mensaje && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {mensaje.texto}
          </div>
        )}
        <button onClick={crearUsuario} disabled={creando}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {creando ? 'Creando…' : '✅ Agregar usuario'}
        </button>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">👥 Mi equipo ({usuarios.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{u.nombre}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${u.rol === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {rolLabel[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!u.es_superadmin && (
                      <button onClick={() => eliminar(u.id, u.nombre)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                    )}
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

// ─── REPORTES ────────────────────────────────────────────
function SeccionReportes({ establecimientoId }: { establecimientoId: number }) {
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [loading, setLoading] = useState(true)
  const [totalVentas, setTotalVentas] = useState(0)
  const [numVentas, setNumVentas] = useState(0)
  const [ventasPorVendedor, setVentasPorVendedor] = useState<any[]>([])
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [ventasPorDia, setVentasPorDia] = useState<any[]>([])
  const [ventasLista, setVentasLista] = useState<any[]>([])

  const getFechaInicio = useCallback(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (periodo === 'hoy') return hoy.toISOString()
    if (periodo === 'semana') { hoy.setDate(hoy.getDate() - 7); return hoy.toISOString() }
    hoy.setDate(hoy.getDate() - 30); return hoy.toISOString()
  }, [periodo])

  const cargar = useCallback(async () => {
    setLoading(true)
    const fechaInicio = getFechaInicio()
    const [ventas, detalle] = await Promise.all([
      supabase.from('ventas').select('*').eq('establecimiento_id', establecimientoId).gte('fecha_venta', fechaInicio).order('fecha_venta'),
      supabase.from('detalle_ventas')
        .select('*, producto:productos(nombre), vendedor:vendedores(nombre), venta:ventas!inner(fecha_venta, establecimiento_id)')
        .eq('venta.establecimiento_id', establecimientoId)
        .gte('venta.fecha_venta', fechaInicio),
    ])
    const v = ventas.data ?? []
    const d = detalle.data ?? []
    setTotalVentas(v.reduce((s, x) => s + x.total, 0))
    setNumVentas(v.length)
    setVentasLista([...v].sort((a, b) => new Date(b.fecha_venta).getTime() - new Date(a.fecha_venta).getTime()))
    const porVendedor: Record<string, { nombre: string; total: number; cantidad: number }> = {}
    d.forEach(item => {
      const nombre = item.vendedor?.nombre ?? 'Sin vendedor'
      if (!porVendedor[nombre]) porVendedor[nombre] = { nombre, total: 0, cantidad: 0 }
      porVendedor[nombre].total += item.precio_unitario * item.cantidad
      porVendedor[nombre].cantidad += item.cantidad
    })
    setVentasPorVendedor(Object.values(porVendedor).sort((a, b) => b.total - a.total))
    const porProducto: Record<string, { nombre: string; cantidad: number; total: number }> = {}
    d.forEach(item => {
      const nombre = item.producto?.nombre ?? 'Desconocido'
      if (!porProducto[nombre]) porProducto[nombre] = { nombre, cantidad: 0, total: 0 }
      porProducto[nombre].cantidad += item.cantidad
      porProducto[nombre].total += item.precio_unitario * item.cantidad
    })
    setTopProductos(Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5))
    const porDia: Record<string, number> = {}
    v.forEach(venta => {
      const dia = new Date(venta.fecha_venta).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' })
      porDia[dia] = (porDia[dia] ?? 0) + venta.total
    })
    setVentasPorDia(Object.entries(porDia).map(([dia, total]) => ({ dia, total })))
    setLoading(false)
  }, [establecimientoId, getFechaInicio])

  useEffect(() => { cargar() }, [cargar])

  const fmt = (n: number) => `$${n.toFixed(2)}`
  const maxVendedor = ventasPorVendedor[0]?.total || 1
  const maxProducto = topProductos[0]?.cantidad || 1

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Esta semana' }, { id: 'mes', label: 'Este mes' }].map(({ id, label }) => (
          <button key={id} onClick={() => setPeriodo(id as any)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${periodo === id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(totalVentas)}</div>
              <div className="text-xs text-gray-400 mt-1">Total vendido</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl mb-2">🧾</div>
              <div className="text-3xl font-bold text-gray-900">{numVentas}</div>
              <div className="text-xs text-gray-400 mt-1">Transacciones</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(numVentas ? totalVentas / numVentas : 0)}</div>
              <div className="text-xs text-gray-400 mt-1">Ticket promedio</div>
            </div>
          </div>
          {ventasPorDia.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">📈 Ventas totales</h2>
              <div className="flex items-end gap-2 h-32">
                {ventasPorDia.map(({ dia, total }) => (
                  <div key={dia} className="flex flex-col items-center flex-1 gap-1">
                    <div className="text-[10px] text-gray-500 font-medium">{fmt(total)}</div>
                    <div className="w-full bg-blue-500 rounded-t-md"
                      style={{ height: `${(total / Math.max(...ventasPorDia.map(v => v.total))) * 96}px` }} />
                    <div className="text-[10px] text-gray-400 text-center">{dia}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">👤 Liquidación por vendedor</h2>
              {ventasPorVendedor.length === 0 ? <p className="text-sm text-gray-400">Sin ventas en este período</p> : (
                <div className="space-y-4">
                  {ventasPorVendedor.map((v, i) => (
                    <div key={v.nombre}>
                      <div className="flex justify-between items-center mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{v.nombre}</span>
                          <span className="ml-2 text-xs text-gray-400">{v.cantidad} uds</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{fmt(v.total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-green-500' : i === 2 ? 'bg-amber-500' : 'bg-purple-500'}`}
                          style={{ width: `${(v.total / maxVendedor) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-700">Total general</span>
                      <span className="text-gray-900">{fmt(totalVentas)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">🏆 Top 5 productos más vendidos</h2>
              {topProductos.length === 0 ? <p className="text-sm text-gray-400">Sin ventas en este período</p> : (
                <div className="space-y-3">
                  {topProductos.map((p, i) => (
                    <div key={p.nombre}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                            ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-700 truncate max-w-[140px]">{p.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-gray-900">{p.cantidad} uds</div>
                          <div className="text-[10px] text-gray-400">{fmt(p.total)}</div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className={`h-1.5 rounded-full ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-blue-400'}`}
                          style={{ width: `${(p.cantidad / maxProducto) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">📋 Ventas del período ({ventasLista.length})</h2>
            </div>
            {ventasLista.length === 0 ? <div className="p-5 text-sm text-gray-400">Sin ventas en este período</div> : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-xs text-gray-400">
                  <tr>
                    <th className="px-5 py-3 text-left">Comprobante</th>
                    <th className="px-5 py-3 text-left">Fecha</th>
                    <th className="px-5 py-3 text-left">Pago</th>
                    <th className="px-5 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasLista.map(venta => {
                    const tieneDescuento = (venta.descuento_total ?? 0) > 0
                    return (
                      <tr key={venta.id} className={`border-b border-gray-50 hover:bg-gray-50 ${tieneDescuento ? 'bg-orange-50' : ''}`}>
                        <td className={`px-5 py-3 font-mono text-xs ${tieneDescuento ? 'font-bold text-orange-600' : 'text-gray-600'}`}>
                          {venta.numero_comprobante}
                        </td>
                        <td className={`px-5 py-3 text-xs ${tieneDescuento ? 'font-bold text-orange-600' : 'text-gray-500'}`}>
                          {new Date(venta.fecha_venta).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className={`px-5 py-3 text-xs capitalize ${tieneDescuento ? 'font-bold text-orange-600' : 'text-gray-500'}`}>
                          {venta.metodo_pago}
                        </td>
                        <td className={`px-5 py-3 text-right ${tieneDescuento ? 'font-bold text-orange-600' : 'font-medium text-gray-900'}`}>
                          {fmt(venta.total)}
                          {tieneDescuento && <span className="ml-1.5 text-[10px]">(− {fmt(venta.descuento_total)})</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}