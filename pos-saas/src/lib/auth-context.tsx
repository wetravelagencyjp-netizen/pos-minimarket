'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcularEstadoSuscripcion, type Usuario, type Establecimiento, type EstadoSuscripcion } from '@/types'

interface AuthContextValue {
  usuario: Usuario | null
  estadoSuscripcion: EstadoSuscripcion | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [estadoSuscripcion, setEstadoSuscripcion] = useState<EstadoSuscripcion | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const cargarPerfil = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, establecimiento:establecimientos(*)')
      .eq('id', userId)
      .single()

    if (error || !data) {
      setUsuario(null)
      setEstadoSuscripcion(null)
      return
    }

    const row = data as unknown as Record<string, unknown>
    const estab = row.establecimiento as Establecimiento
    const usuarioFinal: Usuario = {
      id: row.id as string,
      establecimiento_id: row.establecimiento_id as number,
      nombre: row.nombre as string | null,
      rol: row.rol as 'admin' | 'cajero',
      creado_en: row.creado_en as string,
      establecimiento: estab,
    }

    setUsuario(usuarioFinal)

    const estado = calcularEstadoSuscripcion(estab)
    setEstadoSuscripcion(estado)

    if (estado === 'vencida' || estado === 'suspendida') {
      const urlPago = estab.url_pago ?? ''
      router.push(`/suscripcion-vencida?url=${encodeURIComponent(urlPago)}&nombre=${encodeURIComponent(estab.nombre)}`)
    }
  }, [router])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        cargarPerfil(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        cargarPerfil(session.user.id)
      } else {
        setUsuario(null)
        setEstadoSuscripcion(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [cargarPerfil])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ usuario, estadoSuscripcion, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
