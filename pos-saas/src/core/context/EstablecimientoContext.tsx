'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Tenant, PerfilUsuario } from '@/core/types/modulos.types'

// ─── Shape del contexto ───────────────────────────────────────
interface EstablecimientoContextValue {
  tenant: Tenant | null
  perfil: PerfilUsuario | null
  sucursalId: string | null
  isLoading: boolean
  error: string | null
}

const EstablecimientoContext = createContext<EstablecimientoContextValue>({
  tenant: null,
  perfil: null,
  sucursalId: null,
  isLoading: true,
  error: null,
})

// ─── Provider ─────────────────────────────────────────────────
export function EstablecimientoProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant]   = useState<Tenant | null>(null)
  const [perfil, setPerfil]   = useState<PerfilUsuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function cargarContexto() {
      try {
        // 1. Sesión activa del usuario
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Sin sesión activa')

        // 2. Perfil: rol + sucursal + tenant_id
        const { data: perfilData, error: perfilError } = await supabase
          .from('perfiles_usuarios')
          .select('id, tenant_id, sucursal_id, nombre, rol')
          .eq('id', user.id)
          .single()

        if (perfilError || !perfilData) throw new Error('Perfil de usuario no encontrado')
        setPerfil(perfilData as PerfilUsuario)

        // 3. Datos del tenant (business_type, suscripción, estrategia precio)
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('id, nombre_comercio, business_type, estado_suscripcion, estrategia_precio_defecto, creado_en')
          .eq('id', perfilData.tenant_id)
          .single()

        if (tenantError || !tenantData) throw new Error('Establecimiento no encontrado')
        setTenant(tenantData as Tenant)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    cargarContexto()

    // Reacciona si el usuario cierra sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setTenant(null)
        setPerfil(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <EstablecimientoContext.Provider
      value={{
        tenant,
        perfil,
        sucursalId: perfil?.sucursal_id ?? null,
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