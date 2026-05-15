/**
 * Utilidad para generar CSV compatible con Excel (locale español).
 *
 * Notas:
 *  • Usa `;` como separador (Excel español lo espera por defecto).
 *  • Antepone BOM UTF-8 para que Excel respete tildes y ñ.
 *  • Escapa comillas y celdas que contengan separador / saltos de línea.
 */

export type CSVCell = string | number | boolean | null | undefined | Date

export function toCSV(
  rows: Record<string, CSVCell>[],
  headers?: { key: string; label: string }[]
): string {
  if (rows.length === 0 && !headers) return '\uFEFF'

  // Si no se pasaron headers, los inferimos desde la primera fila
  const cols = headers ?? Object.keys(rows[0] ?? {}).map((k) => ({ key: k, label: k }))

  const escape = (v: CSVCell): string => {
    if (v === null || v === undefined) return ''
    let s: string
    if (v instanceof Date) {
      s = v.toISOString().split('T')[0]
    } else if (typeof v === 'boolean') {
      s = v ? 'sí' : 'no'
    } else {
      s = String(v)
    }
    // Si tiene separador, comillas o salto → entrecomillamos
    if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const headerRow = cols.map((c) => escape(c.label)).join(';')
  const dataRows = rows.map((row) =>
    cols.map((c) => escape(row[c.key])).join(';')
  )

  // BOM + filas con CRLF (Excel lo prefiere)
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n')
}

/**
 * Helper para responder un CSV desde una route handler de Next.
 */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Formatea fecha como "DD/MM/YYYY" para visualización en Excel.
 */
export function fechaCorta(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}
