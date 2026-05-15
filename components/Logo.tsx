import Image from 'next/image'
import Link from 'next/link'

type Props = {
  /** Alto en px del logo. El ancho lo calcula automáticamente. */
  size?: number
  /** Si se pasa, envuelve el logo en un Link. */
  href?: string
  /** Texto que va al lado del logo. Pasar null para no mostrar nada. */
  subtitulo?: string | null
  /** Color del texto, por defecto slate-900. */
  textoClassName?: string
  /** Clases extra del contenedor. */
  className?: string
}

/**
 * Logo institucional de la Escuela Técnica N° 34 - BRATTI.
 * El SVG vive en /public/logobratti.svg y ya incluye el nombre completo,
 * así que el "subtítulo" que pasamos al lado es solo el contexto del módulo
 * (ej: "Cooperadora", "Panel administrativo", etc.).
 */
export function Logo({
  size = 44,
  href,
  subtitulo = 'Cooperadora',
  textoClassName = 'text-slate-900',
  className = '',
}: Props) {
  // Aspect ratio aproximado del SVG (ancho : alto)
  const ASPECT = 1.35
  const width = Math.round(size * ASPECT)

  const contenido = (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/logobratti.svg"
        alt="Bratti — Escuela Técnica N° 34"
        width={width}
        height={size}
        priority
      />
      {subtitulo !== null && (
        <span className={`text-sm font-semibold ${textoClassName}`}>{subtitulo}</span>
      )}
    </div>
  )

  return href ? <Link href={href} className="inline-flex">{contenido}</Link> : contenido
}
