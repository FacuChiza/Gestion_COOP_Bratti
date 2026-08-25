/**
 * Backup de la base de datos — Cooperadora Escolar Bratti
 * ─────────────────────────────────────────────────────────────────────
 * Genera una copia completa de todos los datos en la carpeta `backups/`.
 *
 * CÓMO USARLO
 *   npm run backup
 *   (o doble clic en scripts/backup.bat en Windows)
 *
 * QUÉ GENERA
 *   backups/backup-AAAA-MM-DD.json  → todos los datos, para restaurar
 *   backups/backup-AAAA-MM-DD.csv   → alumnos y aportes, para abrir en Excel
 *
 * CUÁNDO CONVIENE CORRERLO
 *   • Una vez por mes como rutina.
 *   • Antes de importar un padrón nuevo o de un cierre de ciclo.
 *
 * Guardá los archivos en un lugar seguro (Drive, pendrive, etc.).
 * Contienen datos personales de alumnos: no los subas a repositorios.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Leer credenciales de .env.local ─────────────────────────────────
function leerEnv() {
  const ruta = path.join(RAIZ, '.env.local')
  if (!fs.existsSync(ruta)) {
    console.error('❌ No se encontró .env.local en la carpeta del proyecto.')
    process.exit(1)
  }
  const env = {}
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const i = limpia.indexOf('=')
    if (i === -1) continue
    env[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim()
  }
  return env
}

const env = leerEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

const TABLAS = [
  'pagadores', 'alumnos', 'planes', 'suscripciones',
  'cuotas', 'pagos', 'pagos_cuotas', 'configuracion',
]

/** Trae una tabla completa paginando de a 1000 filas. */
async function traerTodo(tabla) {
  const filas = []
  const paso = 1000
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await db.from(tabla).select('*').range(desde, desde + paso - 1)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...(data ?? []))
    if (!data || data.length < paso) break
  }
  return filas
}

function aCSV(filas) {
  if (!filas.length) return ''
  const cols = Object.keys(filas[0])
  const esc = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [
    cols.join(';'),
    ...filas.map((f) => cols.map((c) => esc(f[c])).join(';')),
  ].join('\r\n')
}

async function main() {
  const hoy = new Date().toISOString().split('T')[0]
  const dir = path.join(RAIZ, 'backups')
  fs.mkdirSync(dir, { recursive: true })

  console.log('\n📦 Generando backup de la base de datos…\n')

  const backup = { generado: new Date().toISOString(), origen: url, datos: {} }
  let total = 0

  for (const tabla of TABLAS) {
    process.stdout.write(`   ${tabla.padEnd(16)} `)
    try {
      const filas = await traerTodo(tabla)
      backup.datos[tabla] = filas
      total += filas.length
      console.log(`${String(filas.length).padStart(5)} registros`)
    } catch (e) {
      console.log(`ERROR — ${e.message}`)
      backup.datos[tabla] = []
    }
  }

  const archivoJson = path.join(dir, `backup-${hoy}.json`)
  fs.writeFileSync(archivoJson, JSON.stringify(backup, null, 2), 'utf8')

  // CSV legible de alumnos (lo más útil para consultar a mano)
  const archivoCsv = path.join(dir, `alumnos-${hoy}.csv`)
  fs.writeFileSync(archivoCsv, aCSV(backup.datos.alumnos ?? []), 'utf8')

  const mb = (fs.statSync(archivoJson).size / 1024 / 1024).toFixed(2)
  console.log(`\n✅ Backup completo — ${total} registros (${mb} MB)`)
  console.log(`   ${archivoJson}`)
  console.log(`   ${archivoCsv}`)
  console.log('\n⚠️  Contiene datos personales de alumnos.')
  console.log('   Guardalo en un lugar seguro y NO lo subas a repositorios.\n')
}

main().catch((e) => {
  console.error('\n❌ El backup falló:', e.message, '\n')
  process.exit(1)
})
