# Deploy Backend en Railway + Neon (Postgres)

Este backend usa Node/Express + Prisma.

## 1) Crear la base de datos en Neon

1. Creá un proyecto en Neon.
2. Copiá las 2 cadenas de conexión (si Neon te las ofrece):
   - **Pooled** (pooler) → usarla como `DATABASE_URL` (runtime del backend).
   - **Direct** (direct connection) → usarla como `DIRECT_URL` (migraciones Prisma).

Ejemplo (Neon suele requerir SSL):
- `postgresql://USER:PASS@HOST/DB?sslmode=require`

## 2) Crear el servicio en Railway

1. Railway → New Project → Deploy from GitHub (o el método que uses).
2. Si tu repo es monorepo, configurá el servicio con **Root Directory = `backend`**.
3. Comandos recomendados:
   - **Build**: `npm run build`
   - **Start**: `npm run start:railway`

`start:railway` corre `prisma migrate deploy` y luego arranca el server.

### Troubleshooting (Prisma)

- `P3009` (failed migrations): hay una migración marcada como fallida en la tabla `_prisma_migrations`. Si la DB no tiene datos importantes todavía, lo más simple es resetear el schema (por ejemplo `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) y redeploy.
- `42601` con `\u{feff}` / `-- CreateEnum`: el archivo `migration.sql` tiene BOM UTF-8. Hay que reescribirlo como UTF-8 **sin** BOM y luego limpiar el estado de la migración fallida en la DB.

## 3) Variables de entorno (Railway)

Mínimas:
- `DATABASE_URL` = Neon pooled
- `DIRECT_URL` = Neon direct (recomendado)
- `JWT_SECRET` = mínimo 20 chars
- `JWT_EXPIRES_IN` = por ejemplo `7d`
- `CORS_ORIGIN` = por ejemplo `http://localhost:19006` (dev)

Uploads (Cloudinary) (recomendado en Railway):
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- (opcional) `CLOUDINARY_FOLDER` (default: `xpress`)

Push notifications (FCM) (para que salgan notificaciones):
- `FCM_SERVICE_ACCOUNT_JSON` = JSON del service account de Firebase (recomendado)
- o `FCM_SERVICE_ACCOUNT_PATH` = path a un archivo JSON (menos práctico en Railway)

Notas:
- Si NO configurás Cloudinary, el backend cae a uploads locales (en Railway el disco no es persistente).
- Si NO configurás FCM, el backend no enviará push (la app igual funciona).

## 4) Verificación rápida

Cuando termine el deploy:
- `GET /health` → `{ ok: true }`
- `GET /health/db` → `{ ok: true }` si Prisma conecta bien

## 5) Seed (crear admin y usuarios demo)

El repo trae un seed por Prisma (admin + usuarios demo + pricing mínimo). Opciones:

- Local (apunta a Neon):
  1. En `backend/`, configurá `DATABASE_URL`/`DIRECT_URL` hacia Neon.
  2. Corré `npx prisma migrate deploy`
   3. Corré `npx prisma db seed`

Notas:
- El archivo `prisma/dev_test_users.sql` es legado de MySQL/MariaDB y no aplica para Postgres.

Credenciales que crea el seed:
- Admin: `admin@xpress.local` / `xpress_admin`
- Cliente demo: `cliente@xpress.local` / `xpress_test`
- Chofer demo: `chofer@xpress.local` / `xpress_test`

## 6) Conectar el frontend

En el frontend, apuntá `EXPO_PUBLIC_API_BASE_URL` a tu backend Railway:
- `https://TU-SERVICIO.up.railway.app/api`
