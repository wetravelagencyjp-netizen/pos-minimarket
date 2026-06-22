'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Establecimiento, Usuario } from '@/core/types/modulos.types'

interface EstablecimientoContextValue {
  establecimiento: Establecimiento | null
  usuario: Usuario | null
  sucursalId: number | null
  isLoading: boolean
  error: string | null
  tema: 'claro' | 'oscuro'
  cambiarTema: (t: 'claro' | 'oscuro') => void
}

const EstablecimientoContext = createContext<EstablecimientoContextValue>({
  establecimiento: null,
  usuario: null,
  sucursalId: null,
  isLoading: true,
  error: null,
  tema: 'claro',
  cambiarTema: () => {},
})

export function EstablecimientoProvider({ children }: { children: ReactNode }) {
  const [establecimiento, setEstablecimiento] = useState<Establecimiento | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tema, setTema] = useState<'claro' | 'oscuro'>('claro')

  useEffect(() => {
    async function cargarContexto() {
      console.log('🔵 PASO 1: Iniciando carga de contexto')
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        console.log('🔵 PASO 2: Usuario auth:', user?.id, 'error:', authError)
        if (authError || !user) throw new Error('Sin sesión activa')

        const { data: usuarioData, error: usuarioError } = await supabase
          .from('usuarios')
          .select('id, establecimiento_id, sucursal_id, nombre, email, rol, es_superadmin, tema_checkout, tema_ui')
          .eq('id', user.id)
          .single()

        console.log('🔵 PASO 3: Usuario data:', usuarioData, 'error:', usuarioError)
        if (usuarioError || !usuarioData) throw new Error('Usuario no encontrado en el sistema')
        setUsuario(usuarioData as Usuario)
        setTema(((usuarioData as any).tema_ui ?? (usuarioData as any).tema_checkout ?? 'claro') as 'claro' | 'oscuro')

        console.log('🔵 PASO 4: Buscando establecimiento con id:', usuarioData.establecimiento_id)
        const { data: establecimientoData, error: establecimientoError } = await supabase
          .from('establecimientos')
          .select('id, nombre, ruc_nit, direccion, estado_suscripcion, estado_cuenta, fecha_vencimiento, plan_actual, limite_productos, modo_multivendedor, margen_costo_estimado, business_type, creado_en, alerta_caducidad_dias, alerta_caducidad_estilo, permite_venta_sin_stock, pais, ancho_recibo, logo_url, modulo_contabilidad, whatsapp, email_negocio')
          .eq('id', usuarioData.establecimiento_id)
          .single()

        console.log('🔵 PASO 5: Establecimiento data:', establecimientoData, 'error:', establecimientoError)
        if (establecimientoError || !establecimientoData) throw new Error('Establecimiento no encontrado')
        setEstablecimiento(establecimientoData as Establecimiento)

        console.log('🟢 ÉXITO: Contexto cargado completo')

      } catch (err) {
        console.log('🔴 ERROR CAPTURADO:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
        console.log('🔵 PASO FINAL: isLoading = false')
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

  const cambiarTema = async (nuevoTema: 'claro' | 'oscuro') => {
    setTema(nuevoTema)
    if (usuario) {
      await supabase.from('usuarios').update({ tema_ui: nuevoTema, tema_checkout: nuevoTema }).eq('id', usuario.id)
    }
  }

  return (
    <EstablecimientoContext.Provider
      value={{
        establecimiento,
        usuario,
        sucursalId: usuario?.sucursal_id ?? null,
        isLoading,
        error,
        tema,
        cambiarTema,
      }}
    >
      {children}
    </EstablecimientoContext.Provider>
  )
}

export function useEstablecimiento() {
  const ctx = useContext(EstablecimientoContext)
  if (!ctx) throw new Error('useEstablecimiento debe usarse dentro de <EstablecimientoProvider>')
  return ctx
}