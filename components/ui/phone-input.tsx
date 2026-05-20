'use client'

import { useState, useEffect, forwardRef } from 'react'
import { Input } from './input'
import { cn } from '@/lib/utils'

/**
 * Input de teléfono argentino con formato automático.
 *
 * - El usuario solo tipea dígitos.
 * - Se muestra formateado: "11 1234-5678" (caracter visual).
 * - El valor que sale por onChange es solo dígitos (sin espacios ni guiones).
 * - Asume Argentina por defecto: prefix +54 9 visible aparte (no se edita).
 *
 * Reglas de formato (10 dígitos sin código de país):
 *   2 dígitos área + 4 dígitos + 4 dígitos      →  "11 1234-5678"
 *   3 dígitos área + 3 dígitos + 4 dígitos      →  "351 123-4567"
 *   4 dígitos área + 2 dígitos + 4 dígitos      →  "2944 12-3456"
 */

function formatearArgentino(soloDigitos: string): string {
  const d = soloDigitos.slice(0, 10) // máx 10 dígitos
  const len = d.length

  // Patrón básico: si tiene 10 dígitos y empieza con 11, es CABA/GBA
  if (len === 0) return ''
  if (len <= 2) return d
  if (len === 10 && d.startsWith('11')) {
    return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6, 10)}`
  }
  if (len === 10 && /^[2-9]/.test(d)) {
    // 3 + 3 + 4 (la mayoría de áreas)
    return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 10)}`
  }
  // Mientras tipea (incompleto)
  if (len <= 4) return d
  if (len <= 8) return `${d.slice(0, len - 4)} ${d.slice(len - 4)}`
  return `${d.slice(0, len - 8)} ${d.slice(len - 8, len - 4)}-${d.slice(len - 4)}`
}

export type PhoneInputProps = {
  /** Valor (solo dígitos sin código país). Ej: '1122334455' */
  value: string
  /** Devuelve solo dígitos, sin formato. */
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  id?: string
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput({ value, onChange, placeholder, required, className, id }, ref) {
    const [display, setDisplay] = useState(() => formatearArgentino(value))

    // Re-sincronizar si el value externo cambia (ej. reset)
    useEffect(() => {
      setDisplay(formatearArgentino(value))
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 10)
      const formateado = formatearArgentino(soloDigitos)
      setDisplay(formateado)
      onChange(soloDigitos)
    }

    return (
      <div className={cn('flex items-stretch rounded-md border border-slate-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-400 overflow-hidden', className)}>
        <span className="flex items-center px-3 bg-slate-50 border-r border-slate-200 text-slate-600 text-sm font-medium whitespace-nowrap">
          🇦🇷 +54
        </span>
        <Input
          ref={ref}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={display}
          onChange={handleChange}
          required={required}
          placeholder={placeholder ?? '11 1234-5678'}
          className="border-0 shadow-none focus-visible:ring-0 rounded-none"
        />
      </div>
    )
  },
)
