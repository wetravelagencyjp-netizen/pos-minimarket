'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { POSScreen } from '@/components/pos/POSScreen'

export default function PaginaPOS() {
  const { usuario, estadoSuscripcion, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/login')
    }
  }, [loading, usuario, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Verificando acceso…</p>
        </div>
      </div>
    )
  }

  if (!usuario) return null

  // Si la suscripción está vencida, AuthContext ya redirigió.
  // Este guard es una segunda línea de defensa en el cliente.
  if (estadoSuscripcion && estadoSuscripcion !== 'activa') {
    return null
  }

  return <POSScreen establecimientoId={usuario.establecimiento_id} />
}
