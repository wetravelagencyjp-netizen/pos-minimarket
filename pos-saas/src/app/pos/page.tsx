'use client'
import { useAuth } from '@/lib/auth-context'
import { POSScreen } from '@/components/pos/POSScreen'

export default function PaginaPOS() {
  const { usuario, loading } = useAuth()

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  )

  if (!usuario) return null

  return <POSScreen establecimientoId={usuario.establecimiento_id} />
}
