'use client'

import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import SeccionCotizaciones from '@/components/admin/SeccionCotizaciones'

export default function CotizacionesCajaPage() {
  const { establecimiento } = useEstablecimiento()
  if (!establecimiento) return null
  return <SeccionCotizaciones establecimientoId={establecimiento.id} />
}