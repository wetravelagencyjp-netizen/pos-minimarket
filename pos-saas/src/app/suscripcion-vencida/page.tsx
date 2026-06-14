import { Suspense } from 'react'
import SuscripcionVencidaContent from './SuscripcionVencidaContent'

export default function SuscripcionVencidaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" /></div>}>
      <SuscripcionVencidaContent />
    </Suspense>
  )
}
