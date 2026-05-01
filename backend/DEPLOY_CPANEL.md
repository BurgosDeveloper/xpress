# Deploy backend en CPanel (Node.js App + MariaDB)

## 1) Crear base y usuario (CPanel)
- Creá una base MariaDB y un usuario.
- Asigná el usuario a la base con todos los privilegios.

## 2) Dejar la BD lista (phpMyAdmin)
Recomendado (sin depender de `prisma migrate` en el servidor):

Si la BD está vacía:
- Importá el esquema completo: `export/cpanel_init.sql`

En ambos casos (BD vacía o ya existente):
- Ejecutá el SQL idempotente de índices: `export/20260311_driver_location_indexes_safe.sql`
- (Opcional pero recomendado) Creá/actualizá el admin: `export/cpanel_admin_seed.sql`

Opcional (solo si querés dejar el sistema “desde cero” de carreras):
- `export/clear_rides.sql`

## 3) Configurar Node.js App en CPanel
- Application root: la carpeta donde subas el backend (ideal: el root del subdominio)
- Application startup file: `dist/server.js`
- Node version: la más reciente disponible

Variables de entorno mínimas:
- `DATABASE_URL` (ej: `mysql://USER:PASS@localhost:3306/DBNAME`)
- `JWT_SECRET`
- `CORS_ORIGIN` (ej: `https://TU_DOMINIO.com`)

Notas:
- `PORT` normalmente lo inyecta CPanel automáticamente.
- `WHATSAPP_DEFAULT_COUNTRY_CODE` default `58`.
- Push FCM es opcional: `FCM_SERVICE_ACCOUNT_JSON` o `FCM_SERVICE_ACCOUNT_PATH`.

## 4) Instalar dependencias y compilar
En CPanel:

- Importante (CloudLinux / NodeJS Selector): NO subas una carpeta `node_modules/` dentro del Application root.
	CPanel crea un symlink `node_modules` hacia el virtualenv automáticamente.

- Recomendado: agregá estas env vars en la Node.js App:
	- `NODE_ENV=production` (para no instalar devDependencies)
	- `PRISMA_SKIP_POSTINSTALL_GENERATE=1` (por seguridad extra)
	- `PRISMA_CLIENT_ENGINE_TYPE=binary` (workaround para CloudLinux/OpenSSL 1.0)

- Ejecutá `npm install` desde el panel.

Este ZIP de deploy incluye el Prisma Client pre-generado en `prisma_client/` (con engines Linux).
Durante el `npm install`, el script `postinstall` copia esos archivos a `node_modules/.prisma/client` (dentro del virtualenv), evitando correr `prisma generate` en CPanel.

Nota CloudLinux: el NodeJS Selector puede ejecutar `npm install` con `cwd` dentro del virtualenv (ej: `.../nodevenv/.../lib`). Por eso el `postinstall` usa `INIT_CWD` para ubicar el proyecto correctamente.

Si subís `dist/` ya compilado, no necesitás correr `npm run build` en el servidor.
Luego iniciá/reiniciá la app desde el panel.

## 5) Subidas (uploads)
El backend sirve archivos estáticos desde `/uploads` apuntando a `./uploads` en el Application root.

En producción asegurate de:
- Tener la carpeta `uploads/` en el Application root
- Permisos de escritura (típico `0775`)

## Troubleshooting
- Error “Cloudlinux NodeJS Selector demands… node_modules”: estás subiendo una carpeta `node_modules/` real. Eliminála del Application root y re-subí el ZIP correcto.
- Error Prisma Client: asegurate de que exista `prisma_client/` en el Application root y re-ejecutá `npm install` (para que el postinstall copie a `node_modules/.prisma/client`).
- Si corrés `prisma generate` en CPanel y ves “Out of memory”, no lo hagas ahí: generá en un entorno con más memoria (local/VPS) y volvé a subir el ZIP.
- Si no encontrás logs en CPanel y ves “Database unavailable” desde el frontend, probá el endpoint `GET /health/db`.
	Devuelve el error sanitizado (sin credenciales) para diagnosticar `DATABASE_URL`/permisos/host.
- CORS: revisá `CORS_ORIGIN`.
- 502/503: revisá que el startup file sea `dist/server.js` y que el build haya corrido.
