'use client'

import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { diasRestantes } from '@/types'

export default function SuscripcionVencidaPage() {
  const params      = useSearchParams()
  const urlPago     = decodeURIComponent(params.get('url') ?? '')
  const nombreLocal = decodeURIComponent(params.get('nombre') ?? 'tu local')
  const fechaVenc   = params.get('fecha') ?? ''
  const dias        = fechaVenc ? diasRestantes(fechaVenc) : -999
  const { logout }  = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">

        {/* Icono de alerta */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-5xl">
            🔒
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Suscripción vencida</h1>
          <p className="mt-2 text-gray-500">
            El acceso al POS de <strong className="text-gray-700">{nombreLocal}</strong> ha sido bloqueado.
          </p>
          {dias < 0 && (
            <p className="mt-1 text-sm text-red-500">
              Venció hace {Math.abs(dias)} {Math.abs(dias) === 1 ? 'día' : 'días'}
            </p>
          )}
        </div>

        {/* Tarjeta de acción */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-base font-medium text-gray-900">¿Qué necesitas hacer?</h2>
          <ul className="mb-6 space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              Renovar tu suscripción mensual o anual
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              Después del pago, el acceso se reactiva automáticamente
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              Tus datos, productos e historial están seguros
            </li>
          </ul>

          {/* Botón principal de pago */}
          {urlPago ? (
            <a
              href={urlPago}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white transition hover:bg-green-700 active:scale-[0.98]"
            >
              💳 Renovar suscripción ahora
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ) : (
            <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">
              Contacta al administrador del sistema para renovar.
            </div>
          )}

          {/* Botón secundario: cerrar sesión */}
          <button
            onClick={logout}
            className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Contacto soporte */}
        <p className="mt-6 text-center text-xs text-gray-400">
          ¿Problemas con el pago? Escríbenos por WhatsApp
        </p>

        {/* Badge de seguridad */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
          <span>🔒</span>
          <span>Todos tus datos están seguros y encriptados en Supabase</span>
        </div>
      </div>
    </div>
  )
}
