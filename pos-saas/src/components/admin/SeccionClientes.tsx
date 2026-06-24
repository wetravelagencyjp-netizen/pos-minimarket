'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function SeccionClientes({ establecimientoId }: { establecimientoId: number }) {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({
    identificacion: '', tipo_identificacion: 'cedula', razon_social: '',
    direccion: '', email: '', telefono: '', limite_credito: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

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
      setMensaje('❌ Identificación y nombre son obligatorios'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('clientes').upsert(
      { establecimiento_id: establecimientoId, ...form, limite_credito: parseFloat(form.limite_credito) || 0 },
      { onConflict: 'establecimiento_id,identificacion' }
    )
    setGuardando(false)
    if (!error) {
      setMensaje('✅ Cliente guardado')
      setForm({ identificacion: '', tipo_identificacion: 'cedula', razon_social: '', direccion: '', email: '', telefono: '', limite_credito: '' })
      cargar()
    } else {
      setMensaje(`❌ ${error.message}`)
    }
  }

  const filtrados = clientes.filter(c =>
    c.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.identificacion?.includes(busqueda)
  )

  const inp = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'

  return (
    <div className="space-y-5 text-zinc-100">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">➕ Nuevo cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={form.tipo_identificacion} onChange={e => setForm(f => ({ ...f, tipo_identificacion: e.target.value }))} className={inp}>
            <option value="cedula">Cédula</option>
            <option value="ruc">RUC</option>
            <option value="pasaporte">Pasaporte</option>
            <option value="consumidor_final">Consumidor Final</option>
          </select>
          <input placeholder="Número de identificación *" value={form.identificacion}
            onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} className={`${inp} font-mono`} />
          <div className="sm:col-span-2">
            <input placeholder="Nombre / Razón Social *" value={form.razon_social}
              onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className={inp} />
          </div>
          <input placeholder="Dirección" value={form.direccion}
            onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className={inp} />
          <input type="email" placeholder="Email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} />
          <input placeholder="Teléfono" value={form.telefono}
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className={inp} />
          <input type="number" placeholder="Límite de crédito" value={form.limite_credito}
            onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))} className={inp} />
        </div>
        {mensaje && <p className={`text-xs ${mensaje.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>{mensaje}</p>}
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </div>

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-white whitespace-nowrap">Clientes ({clientes.length})</h2>
          <input placeholder="Buscar…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="flex-1 min-w-[140px] rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500" />
        </div>
        {loading ? <div className="p-5 text-xs text-zinc-500">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Identificación</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Teléfono</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Crédito</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-200 font-medium">{c.razon_social}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs font-mono hidden sm:table-cell">{c.identificacion}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden sm:table-cell">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 text-xs hidden sm:table-cell">${Number(c.limite_credito ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}