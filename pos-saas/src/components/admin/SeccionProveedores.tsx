'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function SeccionProveedores({ establecimientoId }: { establecimientoId: number }) {
  const [proveedores, setProveedores] = useState<any[]>([])
  const [mapeos, setMapeos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ruc: '', nombre: '', telefono: '', email: '', direccion: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('proveedores').select('*').eq('establecimiento_id', establecimientoId).order('nombre'),
      supabase.from('proveedor_codigos_mapeo')
        .select('*, productos(nombre)')
        .eq('establecimiento_id', establecimientoId)
        .order('creado_en', { ascending: false })
        .limit(50),
    ])
    setProveedores(p ?? [])
    setMapeos(m ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.ruc || !form.nombre) { setMensaje('❌ RUC y nombre son obligatorios'); return }
    setGuardando(true)
    const { error } = await supabase.from('proveedores').upsert(
      { establecimiento_id: establecimientoId, ...form },
      { onConflict: 'establecimiento_id,ruc' }
    )
    setGuardando(false)
    if (!error) {
      setMensaje('✅ Proveedor guardado')
      setForm({ ruc: '', nombre: '', telefono: '', email: '', direccion: '' })
      cargar()
    } else {
      setMensaje(`❌ ${error.message}`)
    }
  }

  const inp = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'

  return (
    <div className="space-y-5 text-zinc-100">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">➕ Nuevo proveedor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="RUC *" value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
            className={`${inp} font-mono`} />
          <input placeholder="Nombre / Razón Social *" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inp} />
          <input placeholder="Teléfono" value={form.telefono}
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className={inp} />
          <input type="email" placeholder="Email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} />
          <div className="sm:col-span-2">
            <input placeholder="Dirección" value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className={inp} />
          </div>
        </div>
        {mensaje && <p className={`text-xs ${mensaje.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>{mensaje}</p>}
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
          {guardando ? 'Guardando…' : 'Guardar proveedor'}
        </button>
      </div>

      {/* Lista proveedores con mapeos */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Proveedores ({proveedores.length})</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Toca un proveedor para ver sus equivalencias de códigos XML</p>
        </div>
        {loading ? <div className="p-5 text-xs text-zinc-500">Cargando…</div> : proveedores.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-zinc-500">Sin proveedores. Los proveedores se agregan automáticamente al procesar facturas XML del SRI.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {proveedores.map(p => {
              const mapeosProveedor = mapeos.filter(m => m.ruc_proveedor === p.ruc)
              const abierto = expandido === p.ruc
              return (
                <div key={p.id}>
                  <button
                    onClick={() => setExpandido(abierto ? null : p.ruc)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{p.nombre}</p>
                      <p className="text-xs text-zinc-500 font-mono">{p.ruc}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600">{mapeosProveedor.length} equiv.</span>
                      <span className="text-zinc-600 text-xs">{abierto ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {abierto && mapeosProveedor.length > 0 && (
                    <div className="px-5 pb-4 space-y-2 bg-zinc-800/20">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide pt-2">Equivalencias guardadas</p>
                      {mapeosProveedor.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500 font-mono">{m.codigo_xml}</span>
                          <span className="text-zinc-300">→</span>
                          <span className="text-emerald-400 truncate max-w-[160px]">{(m.productos as any)?.nombre ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}