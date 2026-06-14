'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const router    = useRouter()
  const params    = useSearchParams()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const resultado = await login(email, password)
    setLoading(false)

    if (resultado.error) {
      // Traducir errores de Supabase Auth a español
      const errores: Record<string, string> = {
        'Invalid login credentials': 'Correo o contraseña incorrectos.',
        'Email not confirmed': 'Debes confirmar tu correo electrónico primero.',
        'Too many requests': 'Demasiados intentos. Espera unos minutos.',
      }
      setError(errores[resultado.error] ?? resultado.error)
    } else {
      // AuthContext ya verifica suscripción y redirige si está vencida
      const next = params.get('next') ?? '/pos'
      router.push(next)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo / Marca */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl">
            🛒
          </div>
          <h1 className="text-xl font-semibold text-gray-900">POS Minimarket</h1>
          <p className="mt-1 text-sm text-gray-500">Ingresa para continuar</p>
        </div>

        {/* Formulario */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cajero@minimarket.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                ⚠ {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verificando suscripción…
                </>
              ) : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        {/* Ayuda para pruebas locales */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
            <p className="font-medium mb-1">🧪 Modo desarrollo</p>
            <p>Crea un usuario en: <strong>Supabase → Authentication → Users → Invite user</strong></p>
            <p className="mt-1">Luego vincúlalo con un establecimiento ejecutando en SQL Editor:</p>
            <code className="mt-1 block rounded bg-amber-100 p-1.5 font-mono">
              INSERT INTO usuarios (id, establecimiento_id, nombre, rol)<br/>
              VALUES (&apos;UUID-DEL-USUARIO&apos;, 1, &apos;Admin&apos;, &apos;admin&apos;);
            </code>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Sistema POS Multivendedor · v1.0
        </p>
      </div>
    </div>
  )
}
