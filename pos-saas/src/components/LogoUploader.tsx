'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface LogoUploaderProps {
  establecimientoId: number
  currentLogoUrl?: string | null
  onUploaded?: (url: string) => void
}

const MAX_SIZE_MB = 2
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export default function LogoUploader({
  establecimientoId,
  currentLogoUrl,
  onUploaded,
}: LogoUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Formato no soportado. Usa PNG, JPG, WEBP o SVG.'
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `El archivo supera ${MAX_SIZE_MB}MB.`
    }
    return null
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setError(null)
      setIsUploading(true)
      setPreview(URL.createObjectURL(file))

      try {
        const ext = file.name.split('.').pop()
        const path = `${establecimientoId}/logo-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, file, { cacheControl: '3600', upsert: true })
        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(path)
        const publicUrl = publicUrlData.publicUrl

        const { error: updateError } = await supabase
          .from('establecimientos')
          .update({ logo_url: publicUrl })
          .eq('id', establecimientoId)
        if (updateError) throw updateError

        setPreview(publicUrl)
        onUploaded?.(publicUrl)
      } catch (err) {
        console.error('Error subiendo el logo:', err)
        setError('No se pudo subir el logo. Intenta de nuevo.')
        setPreview(currentLogoUrl ?? null)
      } finally {
        setIsUploading(false)
      }
    },
    [establecimientoId, currentLogoUrl, onUploaded]
  )

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div className="w-full max-w-sm">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Logo del negocio
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleSelect}
          className="hidden"
        />

        {preview ? (
          <img src={preview} alt="Vista previa del logo" className="max-h-full max-w-full object-contain p-4" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12M12 7.5v9" />
            </svg>
            <p className="text-sm text-center">Arrastra tu logo aquí o haz clic para seleccionar</p>
            <p className="text-xs text-gray-400">PNG, JPG, WEBP o SVG · máx. {MAX_SIZE_MB}MB</p>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
            <span className="text-sm text-gray-600">Subiendo...</span>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}