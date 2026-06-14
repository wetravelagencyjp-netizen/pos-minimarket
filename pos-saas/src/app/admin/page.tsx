'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<'productos' | 'vendedores' | 'categorias'>('productos')

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pos')} className="text-xs text-gray-400 hover:text-gray-600">
            ← Volver al POS
          </button>
          <h1 className="text-sm font-semibold text-gray-900">Panel de Administración</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">
            Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 border-r border-gray-100 bg-white p-4 space-y-1">
          {[
            { id: 'productos', label: '📦 Productos' },
            { id: 'vendedores', label: '👤 Vendedores' },
            { id: 'categorias', label: '🏷️ Categorías' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setSeccion(id as any)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors
                ${seccion === id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </aside>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-6">
          {seccion === 'productos' && <SeccionProductos />}
          {seccion === 'vendedores' && <SeccionVendedores />}
          {seccion === 'categorias' && <SeccionCategorias />}
        </main>
      </div>
    </div>
  )
}

function SeccionProductos() {
  return <div className="text-sm text-gray-500">Cargando productos…</div>
}
function SeccionVendedores() {
  return <div className="text-sm text-gray-500">Cargando vendedores…</div>
}
function SeccionCategorias() {
  return <div className="text-sm text-gray-500">Cargando categorías…</div>
}
