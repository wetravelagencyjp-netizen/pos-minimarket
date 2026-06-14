'use client'

import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SuscripcionVencidaContent() {
  const params      = useSearchParams()
  const urlPago     = decodeURIComponent(params.get('url') ?? '')
  const nombreLocal = decodeURIComponent(params.get('nombre') ?? 'tu local')
  const { logout }  = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-5xl">🔒</div>
          <h1 className="text-2xl font-semibold text-gray-900">Suscripción vencida</h1>
          <p className="mt-2 text-gray-500">El acceso al POS de <strong className="text-gray-700">{nombreLocal}</strong> ha sido bloqueado.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-base font-medium text-gray-900">¿Qué necesitas hacer?</h2>
          <ul className="mb-6 space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">✓</span>Renovar tu suscripción mensual o anual</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">✓</span>Después del pago, el acceso se reactiva automáticamente</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">✓</span>Tus datos, productos e historial están seguros</li>
          </ul>
          {urlPago ? (
            <a href={urlPago} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white transition hover:bg-green-700 active:scale-[0.98]">
              💳 Renovar suscripción ahora
            </a>
          ) : (
            <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">
              Contacta al administrador del sistema para renovar.
            </div>
          )}
          <button onClick={logout}
            className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition hover:border-gray-300 hover:text-gray-700">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
