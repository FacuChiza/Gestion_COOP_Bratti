import ExcelJS from 'exceljs'

/**
 * Generación de archivos Excel (.xlsx) para los informes del panel.
 *
 * Se prioriza que sea cómodo para alguien sin conocimientos técnicos:
 * encabezados destacados y fijos, filtros activados, anchos automáticos,
 * montos con formato de moneda y filas alternadas para leer de corrido.
 */

export type ColumnaExcel = {
  key: string
  label: string
  /** 'texto' (default) · 'moneda' ($) · 'numero' · 'fecha' (dd/mm/aaaa) */
  tipo?: 'texto' | 'moneda' | 'numero' | 'fecha'
  ancho?: number
}

export type FilaExcel = Record<string, string | number | boolean | Date | null | undefined>

const AZUL_OSCURO = 'FF0F172A'
const GRIS_SUAVE  = 'FFF8FAFC'
const BORDE       = 'FFE2E8F0'

export async function generarExcel(params: {
  /** Nombre de la solapa (máx 31 caracteres, sin : \ / ? * [ ]) */
  hoja: string
  titulo?: string
  columnas: ColumnaExcel[]
  filas: FilaExcel[]
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cooperadora Escolar Bratti'
  wb.created = new Date()

  const nombreHoja = params.hoja.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)
  const ws = wb.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', ySplit: params.titulo ? 3 : 1 }],
  })

  let filaActual = 1

  // Título opcional arriba de la tabla
  if (params.titulo) {
    ws.mergeCells(1, 1, 1, Math.max(params.columnas.length, 1))
    const celda = ws.getCell(1, 1)
    celda.value = params.titulo
    celda.font = { name: 'Arial', size: 14, bold: true, color: { argb: AZUL_OSCURO } }
    celda.alignment = { vertical: 'middle' }
    ws.getRow(1).height = 24

    ws.mergeCells(2, 1, 2, Math.max(params.columnas.length, 1))
    const sub = ws.getCell(2, 1)
    sub.value = `Cooperadora Escolar · Escuela Técnica N° 34 Bratti · Generado el ${new Date().toLocaleDateString('es-AR')}`
    sub.font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } }
    filaActual = 3
  }

  // Encabezados
  const filaHeader = ws.getRow(filaActual)
  params.columnas.forEach((col, i) => {
    const c = filaHeader.getCell(i + 1)
    c.value = col.label
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } }
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    c.border = { bottom: { style: 'thin', color: { argb: BORDE } } }
  })
  filaHeader.height = 22
  filaHeader.commit()

  const primeraFilaDatos = filaActual + 1

  // Datos
  params.filas.forEach((fila, idx) => {
    const row = ws.getRow(primeraFilaDatos + idx)
    params.columnas.forEach((col, i) => {
      const celda = row.getCell(i + 1)
      const valor = fila[col.key]

      if (valor === null || valor === undefined || valor === '') {
        celda.value = ''
      } else if (col.tipo === 'moneda' || col.tipo === 'numero') {
        const n = typeof valor === 'number' ? valor : Number(valor)
        celda.value = isNaN(n) ? String(valor) : n
        celda.numFmt = col.tipo === 'moneda' ? '"$"#,##0' : '#,##0'
        celda.alignment = { horizontal: 'right' }
      } else if (col.tipo === 'fecha') {
        const d = valor instanceof Date ? valor : new Date(String(valor))
        if (!isNaN(d.getTime())) {
          celda.value = d
          celda.numFmt = 'dd/mm/yyyy'
          celda.alignment = { horizontal: 'center' }
        } else {
          celda.value = String(valor)
        }
      } else if (typeof valor === 'boolean') {
        celda.value = valor ? 'Sí' : 'No'
        celda.alignment = { horizontal: 'center' }
      } else {
        celda.value = String(valor)
      }

      celda.font = { name: 'Arial', size: 10 }
      celda.border = { bottom: { style: 'hair', color: { argb: BORDE } } }
      // Filas alternadas para leer más cómodo
      if (idx % 2 === 1) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_SUAVE } }
      }
    })
    row.commit()
  })

  // Filtros y anchos
  if (params.filas.length > 0) {
    ws.autoFilter = {
      from: { row: filaActual, column: 1 },
      to: { row: filaActual + params.filas.length, column: params.columnas.length },
    }
  }
  params.columnas.forEach((col, i) => {
    if (col.ancho) {
      ws.getColumn(i + 1).width = col.ancho
      return
    }
    // Ancho automático según el contenido más largo (con topes razonables)
    const largos = params.filas.map((f) => String(f[col.key] ?? '').length)
    const max = Math.max(col.label.length, ...(largos.length ? largos : [0]))
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 3, 10), 45)
  })

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/** Respuesta HTTP con el archivo .xlsx listo para descargar. */
export function excelResponse(filename: string, buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
