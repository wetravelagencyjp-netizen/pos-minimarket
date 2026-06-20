'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && usuario && usuario.rol !== 'admin') {
      router.push('/pos')
    }
  }, [loading, usuario, router])

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">Cargando…</div>
  }

  if (usuario && usuario.rol !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-sm font-medium text-slate-700">Acceso restringido</p>
          <p className="text-xs text-slate-400">Esta sección es solo para administradores.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}