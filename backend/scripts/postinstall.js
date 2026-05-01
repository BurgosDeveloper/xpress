const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')

function projectRoot() {
  return (
    process.env.INIT_CWD ||
    process.env.npm_config_local_prefix ||
    path.resolve(__dirname, '..')
  )
}

function prismaCliJs(root) {
  return path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
}

function runPrismaGenerate(root) {
  const cli = prismaCliJs(root)
  if (!fs.existsSync(cli)) {
    console.error('[postinstall] prisma CLI no está instalado. Asegurate de tener el paquete `prisma` en dependencies.')
    process.exit(1)
  }

  const result = childProcess.spawnSync(process.execPath, [cli, 'generate'], {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, INIT_CWD: root },
  })

  process.exit(result.status ?? 1)
}

function main() {
  const root = projectRoot()

  // Modo cPanel: si viene un Prisma Client pre-generado, copiarlo al virtualenv.
  const bundledClientDir = path.join(root, 'prisma_client')
  const isCpanel = process.env.CPANEL === '1' && fs.existsSync(bundledClientDir)

  if (isCpanel) {
    // eslint-disable-next-line global-require
    require(path.join(root, 'scripts', 'cpanel-postinstall.js'))
    return
  }

  // Modo normal (Railway/local): generar Prisma Client
  runPrismaGenerate(root)
}

try {
  main()
} catch (err) {
  console.error('[postinstall] error:', err)
  process.exit(1)
}
