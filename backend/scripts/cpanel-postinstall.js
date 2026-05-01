const fs = require('fs')
const path = require('path')

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return false
  fs.mkdirSync(destDir, { recursive: true })

  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
      continue
    }

    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }
  }

  return true
}

function main() {
  const appRoot = path.resolve(__dirname, '..')
  const src = path.join(appRoot, 'prisma_client')
  const dest = path.join(appRoot, 'node_modules', '.prisma', 'client')

  if (!fs.existsSync(src)) {
    // No-op para entornos donde no se empaqueta prisma_client (ej: desarrollo).
    console.log('[cpanel-postinstall] prisma_client/ no existe; omitido')
    return
  }

  const ok = copyDirRecursive(src, dest)
  if (!ok) {
    console.log('[cpanel-postinstall] no se pudo copiar prisma_client; omitido')
    return
  }

  // Asegurar permisos de ejecución para el Binary Engine (query-engine-*)
  try {
    const entries = fs.readdirSync(dest, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.startsWith('query-engine-')) continue
      const full = path.join(dest, entry.name)
      try {
        fs.chmodSync(full, 0o755)
      } catch {
        // si no se puede chmod (restricción hosting), igual intentamos seguir
      }
    }
  } catch {
    // ignore
  }

  console.log('[cpanel-postinstall] Prisma Client pre-generado copiado a node_modules/.prisma/client')
}

try {
  main()
} catch (err) {
  console.error('[cpanel-postinstall] error copiando Prisma Client pre-generado:', err)
  // No cortar el deploy por esto: el runtime fallará con mensaje claro si falta el client.
  process.exit(0)
}
