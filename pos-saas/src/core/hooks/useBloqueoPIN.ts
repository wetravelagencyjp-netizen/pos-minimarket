import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'grpm_pos_locked'
const INACTIVIDAD_MS = 5 * 60 * 1000

export function useBloqueoPIN(activo: boolean) {
  const [bloqueado, setBloqueado] = useState(false)
  const [verificado, setVerificado] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Leer sessionStorage al montar
  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
      setBloqueado(true)
    }
    setVerificado(true)
  }, [])

  const bloquear = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    setBloqueado(true)
  }, [])

  const desbloquear = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setBloqueado(false)
  }, [])

  // Timer de inactividad
  const resetTimer = useCallback(() => {
    if (!activo) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(bloquear, INACTIVIDAD_MS)
  }, [activo, bloquear])

  useEffect(() => {
    if (!activo) return
    const eventos = ['mousedown', 'keydown', 'touchstart', 'scroll']
    eventos.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      eventos.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activo, resetTimer])

  return { bloqueado, verificado, bloquear, desbloquear, resetTimer }
}

export async function validarPinCajero(pin: string): Promise<{
  autorizado: boolean
  error?: string
}> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { autorizado: false, error: 'Ingresa tu PIN' }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.rpc('validar_pin_cajero', {
    p_usuario_id: user?.id,
    p_pin: pin,
  })

  if (error || !data?.autorizado) {
    if (data?.sin_pin) return { autorizado: false, error: 'Sin PIN configurado. Pide al admin.' }
    if (data?.bloqueado_hasta) {
      const min = Math.ceil((new Date(data.bloqueado_hasta).getTime() - Date.now()) / 60000)
      return { autorizado: false, error: `Bloqueado. Intenta en ${min} min.` }
    }
    return { autorizado: false, error: 'PIN incorrecto' }
  }
  return { autorizado: true }
}