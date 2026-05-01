const path = require('path')
const fs = require('fs')
const childProcess = require('child_process')

const root = path.resolve(__dirname, '..')

function prismaCliJs() {
  return path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
}

function run(cmd, args, envOverride) {
  const isWindowsCmd = process.platform === 'win32' && String(cmd).toLowerCase().endsWith('.cmd')
  const result = isWindowsCmd
    ? childProcess.spawnSync('cmd.exe', ['/d', '/s', '/c', `"${cmd}" ${args.join(' ')}`], {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, ...envOverride },
      })
    : childProcess.spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, ...envOverride },
      })
  return result.status ?? 1
}

function redactDbUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    const safe = new URL(urlStr)
    if (safe.username) safe.username = '***'
    if (safe.password) safe.password = '***'
    // Evitar logs enormes: dejamos host + pathname + query
    return `${safe.protocol}//${safe.host}${safe.pathname}${safe.search}`
  } catch {
    return '***invalid-url***'
  }
}

function looksLikePooler(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.host.includes('pooler')) return true
    const pgbouncer = (u.searchParams.get('pgbouncer') || '').toLowerCase()
    if (pgbouncer === 'true' || pgbouncer === '1') return true
    return false
  } catch {
    return false
  }
}

function main() {
  const prismaCli = prismaCliJs()
  if (!fs.existsSync(prismaCli)) {
    console.error('[railway] prisma CLI no está instalado. Revisá dependencies.')
    process.exit(1)
  }

  // Para Neon: usar DIRECT_URL para migraciones si existe
  const migrationDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!migrationDbUrl) {
    console.error('[railway] falta DATABASE_URL (y opcional DIRECT_URL).')
    process.exit(1)
  }

  const usingDirect = !!process.env.DIRECT_URL
  console.log(`[railway] migrate url: ${redactDbUrl(migrationDbUrl)} (direct=${usingDirect})`)

  // En Neon (y otros setups con poolers/pgbouncer) Prisma migrate deploy suele fallar.
  // Si detectamos pooler y no hay DIRECT_URL, frenamos con un mensaje claro.
  if (!usingDirect && looksLikePooler(migrationDbUrl)) {
    console.error('[railway] Tu DATABASE_URL parece ser de pooler/pgbouncer. Configurá DIRECT_URL (sin pooling) para migraciones Prisma.')
    process.exit(1)
  }

  console.log('[railway] running prisma migrate deploy')
  const migrateCode = run(process.execPath, [prismaCli, 'migrate', 'deploy'], { DATABASE_URL: migrationDbUrl })
  if (migrateCode !== 0) process.exit(migrateCode)

  console.log('[railway] starting server')
  const node = process.execPath
  const startCode = run(node, ['dist/server.js'], { DATABASE_URL: process.env.DATABASE_URL })
  process.exit(startCode)
}

main()
