'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Establecimiento, Usuario } from '@/core/types/modulos.types'

// ─── Shape del contexto ───────────────────────────────────────
interface EstablecimientoContextValue {
  establecimiento: Establecimiento | null
  usuario: Usuario | null
  sucursalId: number | null
  isLoading: boolean
  error: string | null
}

const EstablecimientoContext = createContext<EstablecimientoContextValue>({
  establecimiento: null,
  usuario: null,
  sucursalId: null,
  isLoading: true,
  error: null,
})

// ─── Provider ─────────────────────────────────────────────────
export function EstablecimientoProvider({ children }: { children: ReactNode }) {
  const [establecimiento, setEstablecimiento] = useState<Establecimiento | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargarContexto() {
      try {
        // 1. Sesión activa del usuario
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Sin sesión activa')

        // 2. Datos del usuario: establecimiento_id, sucursal_id, rol
        const { data: usuarioData, error: usuarioError } = await supabase
          .from('usuarios')
          .select('id, establecimiento_id, sucursal_id, nombre, email, rol, es_superadmin')
          .eq('id', user.id)
          .single()

        if (usuarioError || !usuarioData) throw new Error('Usuario no encontrado en el sistema')
        setUsuario(usuarioData as Usuario)

        // 3. Datos del establecimiento (incluye business_type)
        const { data: establecimientoData, error: establecimientoError } = await supabase
          .from('establecimientos')
          .select('id, nombre, ruc_nit, direccion, estado_suscripcion, estado_cuenta, fecha_vencimiento, plan_actual, limite_productos, modo_multivendedor, margen_costo_estimado, business_type, creado_en')
          .eq('id', usuarioData.establecimiento_id)
          .single()

        if (establecimientoError || !establecimientoData) throw new Error('Establecimiento no encontrado')
        setEstablecimiento(establecimientoData as Establecimiento)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    cargarContexto()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setEstablecimiento(null)
        setUsuario(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <EstablecimientoContext.Provider
      value={{
        establecimiento,
        usuario,
        sucursalId: usuario?.sucursal_id ?? null,
        isLoading,
        error,
      }}
    >
      {children}
    </EstablecimientoContext.Provider>
  )
}

// ─── Hook de consumo ──────────────────────────────────────────
export function useEstablecimiento() {
  const ctx = useContext(EstablecimientoContext)
  if (!ctx) throw new Error('useEstablecimiento debe usarse dentro de <EstablecimientoProvider>')
  return ctx
}