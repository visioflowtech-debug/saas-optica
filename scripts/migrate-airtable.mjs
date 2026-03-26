/**
 * migrate-airtable.mjs
 * Migración de exámenes clínicos desde Airtable/Zoho CSV al nuevo sistema SaaS Óptica.
 *
 * Uso:
 *   node scripts/migrate-airtable.mjs --dry-run  --file=scripts/migration-data/examenes.csv
 *   node scripts/migrate-airtable.mjs --execute  --file=scripts/migration-data/examenes.csv
 *
 * Variables de entorno requeridas (en .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MIGRATION_USER_EMAIL   ← email del optometrista que se asignará como autor de todos los exámenes
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const ROOT       = resolve(__dirname, '..')

// ─── Cargar .env.local sin depender de dotenv ────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) throw new Error('.env.local no encontrado en ' + ROOT)
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq < 1 || line.trim().startsWith('#')) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key) process.env[key] = val
  }
}

loadEnv()

// ─── Argumentos ──────────────────────────────────────────────────────────
const DRY_RUN  = !process.argv.includes('--execute')
const FILE_ARG = process.argv.find(a => a.startsWith('--file='))?.split('=')[1]
const CSV_FILE = FILE_ARG
  ? resolve(FILE_ARG)
  : join(ROOT, 'scripts', 'migration-data', 'examenes.csv')

// ─── Supabase con service role (sin RLS) ─────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ═══════════════════════════════════════════════════════════════════════════
//   UTILIDADES DE NORMALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/** Normaliza nombre para deduplicación: sin acentos, mayúsculas, espacios múltiples */
function normalizeName(name) {
  return name.trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const PLANO   = new Set(['PL', 'PLANO', 'P.L.', 'P/L', 'PL.', 'PIANO'])
const INVALIDO = new Set(['NEUTRO', 'SIN RX', 'N/A', 'NULO', '-', '--', '---', ''])

/** Convierte texto a número refrativo. "PL" → 0, inválidos → null */
function parseNum(val) {
  if (!val?.trim()) return null
  const u = val.trim().toUpperCase().replace(/\s/g, '')
  if (PLANO.has(u))   return 0
  if (INVALIDO.has(u)) return null
  const n = parseFloat(u.replace(',', '.').replace(/\.{2,}/, '.'))
  return isNaN(n) ? null : n
}

/** Devuelve true si el valor es parseable (para detección de problemas) */
function isValidRefr(val) {
  if (!val?.trim()) return true
  const u = val.trim().toUpperCase()
  if (PLANO.has(u) || INVALIDO.has(u)) return true
  return !isNaN(parseFloat(u.replace(',', '.')))
}

/**
 * Parsea DP en cualquier formato:
 *   "62/58"  → { dp: 62, dp_oi: 58 }
 *   "30 30"  → { dp: 30, dp_oi: 30 }
 *   "64"     → { dp: 64, dp_oi: null }
 */
function parseDP(val) {
  if (!val?.trim()) return { dp: null, dp_oi: null }
  const s = val.trim()
  if (s.includes('/')) {
    const [od, oi] = s.split('/')
    return { dp: parseNum(od), dp_oi: parseNum(oi) }
  }
  const parts = s.split(/\s+/)
  if (parts.length === 2 && !isNaN(parseFloat(parts[0]))) {
    return { dp: parseNum(parts[0]), dp_oi: parseNum(parts[1]) }
  }
  return { dp: parseNum(s), dp_oi: null }
}

/**
 * Parsea fecha en formato "D/M/YYYY" o "DD/MM/YYYY"
 * Devuelve ISO string con hora mediodía hora SV (UTC-6)
 */
function parseDate(str) {
  if (!str?.trim()) return null
  const parts = str.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const year  = y.length === 2 ? `20${y}` : y
  const month = m.padStart(2, '0')
  const day   = d.padStart(2, '0')
  const iso   = `${year}-${month}-${day}`
  if (isNaN(new Date(iso).getTime())) return null
  return `${iso}T12:00:00-06:00`
}

/**
 * Elige la fecha clínica correcta:
 * FECHA (col 33) es la fecha del examen real.
 * FECHA_EXAMEN (col 1) para el lote histórico es la fecha de importación a Airtable.
 */
function getFechaExamen(row) {
  return parseDate(row.fecha_real) ?? parseDate(row.fecha_examen_csv) ?? null
}

/** Construye array de etiquetas médicas desde PADECIMIENTO + OTRO */
function parseEtiquetas(padecimiento, otro) {
  const tags = new Set()
  if (padecimiento?.trim()) {
    for (const t of padecimiento.split(',')) {
      const tag = t.trim()
      if (tag && !['OTRO', 'NINGUNO', 'NINGUNA', 'NONE'].includes(tag.toUpperCase())) {
        tags.add(tag)
      }
    }
  }
  // OTRO solo si es corto (condición puntual, no descripción larga)
  if (otro?.trim() && otro.trim().length < 60) {
    tags.add(otro.trim())
  }
  return [...tags].filter(Boolean)
}

// ═══════════════════════════════════════════════════════════════════════════
//   PARSER CSV
// ═══════════════════════════════════════════════════════════════════════════

/** Divide una línea CSV respetando campos entre comillas */
function splitCSVLine(line) {
  const cols = []
  let inQuotes = false
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur)
  return cols
}

/**
 * Columnas CSV (índice 0-based):
 * 0  PACIENTE          8  MOTIVO           19-22 RF-OD-*
 * 1  FECHA_EXAMEN      9  PROFESION        23-26 RF-OI-*
 * 2  ESTADO            10-13 RA-OD-*       27 OBSERVACIONES
 * 3  LABORATIRIO       14-17 RA-OI-*       28 DP
 * 4  TELEFONO          18 LENTE-USO        29 ALTURA
 * 5  EDAD                                  30 AV-OD
 * 6  PADECIMIENTO                          31 AV-OI
 * 7  OTRO                                  32 FECHA (real)
 *                                          33 Creado por
 *                                          34 IDZOHO
 */
function parseCSV(content) {
  const lines = content
    .replace(/^\uFEFF/, '')   // Remove BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitCSVLine(lines[i])
    if (!c[0]?.trim()) continue
    rows.push({
      lineNum:         i + 1,
      paciente:        c[0]?.trim()  ?? '',
      fecha_examen_csv:c[1]?.trim()  ?? '',
      estado:          c[2]?.trim()  ?? '',
      laboratorio:     c[3]?.trim()  ?? '',
      telefono:        c[4]?.trim()  ?? '',
      edad:            c[5]?.trim()  ?? '',
      padecimiento:    c[6]?.trim()  ?? '',
      otro:            c[7]?.trim()  ?? '',
      motivo:          c[8]?.trim()  ?? '',
      profesion:       c[9]?.trim()  ?? '',
      ra_od_esf:       c[10]?.trim() ?? '', ra_od_cil: c[11]?.trim() ?? '',
      ra_od_eje:       c[12]?.trim() ?? '', ra_od_add: c[13]?.trim() ?? '',
      ra_oi_esf:       c[14]?.trim() ?? '', ra_oi_cil: c[15]?.trim() ?? '',
      ra_oi_eje:       c[16]?.trim() ?? '', ra_oi_add: c[17]?.trim() ?? '',
      lente_uso:       c[18]?.trim() ?? '',
      rf_od_esf:       c[19]?.trim() ?? '', rf_od_cil: c[20]?.trim() ?? '',
      rf_od_eje:       c[21]?.trim() ?? '', rf_od_add: c[22]?.trim() ?? '',
      rf_oi_esf:       c[23]?.trim() ?? '', rf_oi_cil: c[24]?.trim() ?? '',
      rf_oi_eje:       c[25]?.trim() ?? '', rf_oi_add: c[26]?.trim() ?? '',
      observaciones:   c[27]?.trim() ?? '',
      dp:              c[28]?.trim() ?? '',
      altura:          c[29]?.trim() ?? '',
      av_od:           c[30]?.trim() ?? '',
      av_oi:           c[31]?.trim() ?? '',
      fecha_real:      c[32]?.trim() ?? '',
      creado_por:      c[33]?.trim() ?? '',
      idzoho:          c[34]?.trim() ?? '',
    })
  }
  return rows
}

// ═══════════════════════════════════════════════════════════════════════════
//   ANÁLISIS Y REPORTE
// ═══════════════════════════════════════════════════════════════════════════

function analizarRows(rows) {
  // Agrupar por nombre normalizado → 1 paciente, N exámenes
  const pacientesMap = new Map()
  for (const row of rows) {
    const key = normalizeName(row.paciente)
    if (!key || key.length < 3) continue
    if (!pacientesMap.has(key)) pacientesMap.set(key, [])
    pacientesMap.get(key).push(row)
  }

  // Detectar filas con datos problemáticos
  const problemas = []
  for (const row of rows) {
    const issues = []
    const refrCols = [
      row.ra_od_esf, row.ra_od_cil, row.ra_od_eje, row.ra_od_add,
      row.ra_oi_esf, row.ra_oi_cil, row.ra_oi_eje, row.ra_oi_add,
      row.rf_od_esf, row.rf_od_cil, row.rf_od_eje, row.rf_od_add,
      row.rf_oi_esf, row.rf_oi_cil, row.rf_oi_eje, row.rf_oi_add,
    ]
    const badField = refrCols.find(f => f && !isValidRefr(f))
    if (badField) issues.push(`Valor refractivo inválido: "${badField}" (se guardará como null)`)
    if (!getFechaExamen(row)) issues.push('Sin fecha válida (se usará fecha actual)')
    if (row.paciente.trim().length < 3) issues.push('Nombre muy corto')
    if (issues.length) problemas.push({ lineNum: row.lineNum, paciente: row.paciente, issues })
  }

  // Pacientes con más de 1 visita
  const multiVisita = [...pacientesMap.entries()]
    .filter(([, rows]) => rows.length > 1)
    .sort((a, b) => b[1].length - a[1].length)

  // Laboratorios únicos
  const labs = [...new Set(rows.map(r => r.laboratorio).filter(Boolean))].sort()

  return { pacientesMap, problemas, multiVisita, labs }
}

function imprimirReporte(rows, analisis, usuario) {
  const { pacientesMap, problemas, multiVisita, labs } = analisis
  const separador = '═'.repeat(55)

  console.log(`\n${separador}`)
  console.log('           REPORTE DE MIGRACIÓN — DRY RUN')
  console.log(separador)
  console.log(`  Archivo CSV analizado:    ${CSV_FILE}`)
  console.log(`  Optometrista asignado:    ${usuario.nombre} (${usuario.rol})`)
  console.log(`  tenant_id:                ${usuario.tenant_id}`)
  console.log(`  sucursal_id:              ${usuario.sucursal_id}`)
  console.log('')
  console.log(`  Filas totales en CSV:     ${rows.length}`)
  console.log(`  Pacientes únicos:         ${pacientesMap.size}`)
  console.log(`  Exámenes a importar:      ${rows.length}`)
  console.log(`  Con múltiples visitas:    ${multiVisita.length} pacientes`)
  console.log(`  Filas con datos sucios:   ${problemas.length} (se importan marcando valores inválidos como null)`)
  console.log(separador)

  if (multiVisita.length > 0) {
    console.log('\n── Pacientes con múltiples visitas ─────────────────────')
    console.log('   (serán 1 registro de paciente con N exámenes vinculados)\n')
    for (const [nombre, examenes] of multiVisita.slice(0, 40)) {
      const fechas = examenes
        .map(r => r.fecha_real || r.fecha_examen_csv)
        .join(' | ')
      console.log(`  ${nombre.padEnd(45)} ${examenes.length} visitas`)
      console.log(`    Fechas: ${fechas}`)
    }
    if (multiVisita.length > 40) {
      console.log(`  ... y ${multiVisita.length - 40} más`)
    }
  }

  if (problemas.length > 0) {
    console.log('\n── Filas con datos problemáticos ────────────────────────')
    console.log('   (se importan, los campos inválidos quedan como null)\n')
    for (const p of problemas.slice(0, 30)) {
      console.log(`  Línea ${p.lineNum} — ${p.paciente}`)
      for (const issue of p.issues) console.log(`    ⚠️  ${issue}`)
    }
    if (problemas.length > 30) console.log(`  ... y ${problemas.length - 30} más`)
  }

  if (labs.length > 0) {
    console.log('\n── Laboratorios en CSV (irán en observaciones del examen) ─')
    for (const lab of labs) console.log(`  • ${lab}`)
  }

  console.log(`\n${separador}`)
  console.log('  ✅  Dry-run completo. Revisa el reporte arriba.')
  console.log('  Para migrar en real ejecuta:')
  console.log('  node scripts/migrate-airtable.mjs --execute --file=<ruta>')
  console.log(`${separador}\n`)

  // Guardar reporte en archivo
  const reportPath = join(ROOT, 'scripts', 'migration-data', 'reporte-dry-run.txt')
  const multiVisitaStr = multiVisita.map(([n, r]) =>
    `${n} (${r.length} visitas): ${r.map(x => x.fecha_real || x.fecha_examen_csv).join(', ')}`
  ).join('\n')
  const problemasStr = problemas.map(p =>
    `Línea ${p.lineNum} — ${p.paciente}\n  ${p.issues.join('\n  ')}`
  ).join('\n')

  writeFileSync(reportPath, [
    `REPORTE DRY-RUN — ${new Date().toLocaleString('es-SV')}`,
    `Filas: ${rows.length} | Pacientes únicos: ${pacientesMap.size} | Exámenes: ${rows.length}`,
    `Múltiples visitas: ${multiVisita.length} | Problemas: ${problemas.length}`,
    '',
    '=== MÚLTIPLES VISITAS ===',
    multiVisitaStr,
    '',
    '=== DATOS PROBLEMÁTICOS ===',
    problemasStr,
  ].join('\n'), 'utf-8')
  console.log(`  📄 Reporte guardado en: scripts/migration-data/reporte-dry-run.txt\n`)
}

// ═══════════════════════════════════════════════════════════════════════════
//   EJECUCIÓN REAL
// ═══════════════════════════════════════════════════════════════════════════

async function ejecutarMigracion(analisis, usuario) {
  const { pacientesMap } = analisis
  let insertedPatients = 0, insertedExams = 0, errors = 0

  console.log(`\n🚀 Iniciando migración de ${pacientesMap.size} pacientes...\n`)

  for (const [normalizedName, examRows] of pacientesMap) {
    // Usar la fila más antigua como base del perfil del paciente
    const sortedRows = [...examRows].sort((a, b) => {
      const da = parseDate(a.fecha_real) ?? parseDate(a.fecha_examen_csv) ?? ''
      const db = parseDate(b.fecha_real) ?? parseDate(b.fecha_examen_csv) ?? ''
      return da < db ? -1 : 1
    })
    const firstRow = sortedRows[0]

    // Consolidar etiquetas médicas de todas las visitas
    const todasEtiquetas = new Set()
    for (const row of examRows) {
      for (const tag of parseEtiquetas(row.padecimiento, row.otro)) {
        todasEtiquetas.add(tag)
      }
    }

    const edadVal = parseInt(firstRow.edad)
    const patientData = {
      tenant_id:          usuario.tenant_id,
      sucursal_id:        usuario.sucursal_id,
      nombre:             firstRow.paciente.trim().replace(/\s+/g, ' '),
      telefono:           firstRow.telefono || null,
      email:              null,
      profesion:          firstRow.profesion || null,
      etiquetas_medicas:  [...todasEtiquetas],
      edad_aproximada:    !isNaN(edadVal) && edadVal > 0 ? edadVal : null,
      acepta_marketing:   false,
      source_airtable_id: firstRow.idzoho || null,
    }

    const { data: newPatient, error: patientError } = await supabase
      .from('pacientes')
      .insert(patientData)
      .select('id')
      .single()

    if (patientError || !newPatient) {
      console.error(`❌ Paciente "${normalizedName}": ${patientError?.message}`)
      errors++
      continue
    }
    insertedPatients++

    // Insertar todos los exámenes del paciente
    for (const row of examRows) {
      const { dp, dp_oi } = parseDP(row.dp)
      const fechaExamen = getFechaExamen(row) ?? new Date().toISOString()

      // Combinar observaciones + laboratorio + estado en un solo campo
      const partsObs = []
      if (row.laboratorio) partsObs.push(`Lab: ${row.laboratorio}`)
      if (row.estado && row.estado !== 'FINALIZADO') partsObs.push(`[${row.estado}]`)
      if (row.observaciones) partsObs.push(row.observaciones)
      const observaciones = partsObs.join(' | ') || null

      const examData = {
        tenant_id:         usuario.tenant_id,
        sucursal_id:       usuario.sucursal_id,
        paciente_id:       newPatient.id,
        optometrista_id:   usuario.id,
        fecha_examen:      fechaExamen,
        motivo_consulta:   row.motivo || null,
        lente_uso:         row.lente_uso || null,
        // RA
        ra_od_esfera:      parseNum(row.ra_od_esf),
        ra_od_cilindro:    parseNum(row.ra_od_cil),
        ra_od_eje:         parseNum(row.ra_od_eje),
        ra_od_adicion:     parseNum(row.ra_od_add),
        ra_oi_esfera:      parseNum(row.ra_oi_esf),
        ra_oi_cilindro:    parseNum(row.ra_oi_cil),
        ra_oi_eje:         parseNum(row.ra_oi_eje),
        ra_oi_adicion:     parseNum(row.ra_oi_add),
        // RF
        rf_od_esfera:      parseNum(row.rf_od_esf),
        rf_od_cilindro:    parseNum(row.rf_od_cil),
        rf_od_eje:         parseNum(row.rf_od_eje),
        rf_od_adicion:     parseNum(row.rf_od_add),
        rf_oi_esfera:      parseNum(row.rf_oi_esf),
        rf_oi_cilindro:    parseNum(row.rf_oi_cil),
        rf_oi_eje:         parseNum(row.rf_oi_eje),
        rf_oi_adicion:     parseNum(row.rf_oi_add),
        // Medidas
        dp,
        dp_oi,
        altura:            parseNum(row.altura),
        av_od_sin_lentes:  row.av_od || null,
        av_oi_sin_lentes:  row.av_oi || null,
        observaciones,
        source_airtable_id: row.idzoho || null,
      }

      const { error: examError } = await supabase
        .from('examenes_clinicos')
        .insert(examData)

      if (examError) {
        console.error(`  ❌ Examen ${row.fecha_real || row.fecha_examen_csv} de "${row.paciente}": ${examError.message}`)
        errors++
      } else {
        insertedExams++
        process.stdout.write('.')
      }
    }
  }

  console.log('\n')
  console.log('═'.repeat(55))
  console.log('           MIGRACIÓN COMPLETADA')
  console.log('═'.repeat(55))
  console.log(`  ✅ Pacientes insertados:  ${insertedPatients}`)
  console.log(`  ✅ Exámenes insertados:   ${insertedExams}`)
  if (errors > 0) console.log(`  ❌ Errores:              ${errors}`)
  console.log('═'.repeat(55))
  console.log('')
}

// ═══════════════════════════════════════════════════════════════════════════
//   PUNTO DE ENTRADA
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n🔍 MODO: ${DRY_RUN ? 'DRY-RUN (solo análisis, cero cambios en DB)' : '⚠️  EJECUCIÓN REAL — insertando en Supabase'}`)

  // Verificar variables de entorno
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }
  if (!process.env.MIGRATION_USER_EMAIL) {
    console.error('❌ Falta MIGRATION_USER_EMAIL en .env.local')
    console.error('   Agrega: MIGRATION_USER_EMAIL=tu.email@gmail.com')
    process.exit(1)
  }

  // Verificar archivo CSV
  if (!existsSync(CSV_FILE)) {
    console.error(`❌ Archivo no encontrado: ${CSV_FILE}`)
    console.error(`   Coloca el CSV en esa ruta o usa --file=ruta/al/archivo.csv`)
    process.exit(1)
  }

  // Obtener contexto del optometrista
  const { data: usuario, error: userError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, sucursal_id, nombre, rol, email')
    .eq('email', process.env.MIGRATION_USER_EMAIL)
    .single()

  if (userError || !usuario) {
    console.error(`❌ No se encontró usuario con email: ${process.env.MIGRATION_USER_EMAIL}`)
    console.error('   Verifica que el email esté registrado en el sistema.')
    process.exit(1)
  }

  // Permitir sobreescribir la sucursal via env (ej: migración a Casa Matriz)
  const sucursal_id_override = process.env.MIGRATION_SUCURSAL_ID
  if (sucursal_id_override) {
    usuario.sucursal_id = sucursal_id_override
  }

  console.log(`\n👤 Optometrista: ${usuario.nombre} (${usuario.rol})`)
  console.log(`🏢 Tenant: ${usuario.tenant_id}`)
  console.log(`🏥 Sucursal: ${usuario.sucursal_id}${sucursal_id_override ? ' (override via MIGRATION_SUCURSAL_ID)' : ''}`)

  // Parsear CSV
  const content = readFileSync(CSV_FILE, 'utf-8')
  const rows = parseCSV(content).filter(r => r.paciente.trim().length >= 3)
  console.log(`\n📊 Filas válidas en CSV: ${rows.length}`)

  // Analizar
  const analisis = analizarRows(rows)

  if (DRY_RUN) {
    imprimirReporte(rows, analisis, usuario)
    return
  }

  // Confirmación extra antes de ejecutar
  if (!process.argv.includes('--yes')) {
    console.log(`\n⚠️  Se van a insertar ${analisis.pacientesMap.size} pacientes y ${rows.length} exámenes.`)
    console.log('   Para confirmar, vuelve a ejecutar con --execute --yes\n')
    return
  }

  await ejecutarMigracion(analisis, usuario)
}

main().catch(e => { console.error('\n❌ Error fatal:', e.message); process.exit(1) })
