# iOS setup

Estado actual del proyecto en iPhone:

- Realtime activo por Socket.IO cuando la app esta abierta.
- Sonidos foreground disparados por eventos realtime, sin depender de push.
- Push iOS pausado por defecto en esta iteracion.
- Ubicacion del chofer en segundo plano por `expo-location` solo en iOS, para seguir sincronizando posicion con la app minimizada.

No se cambio la ruta Android. Android sigue usando FCM con la service account actual.

## Archivos y credenciales

### Frontend

- `GoogleService-Info.plist`:
  - Opcional para el flujo actual de push iOS.
  - Si lo agregas en `frontend/GoogleService-Info.plist` o en la raiz del repo, `app.config.js` lo detecta y Expo lo inyecta en iOS automaticamente.
  - El build local sincroniza automaticamente el archivo de la raiz hacia `frontend/GoogleService-Info.plist` si existe.
  - No va en Railway.

- Mapbox:
  - La app ya usa `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` en runtime.
  - Para prebuild/build nativo iOS con `@rnmapbox/maps`, define `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`.
  - Si ya usas `MAPBOX_DOWNLOADS_TOKEN`, `app.config.js` lo reutiliza automaticamente.

### Railway

- Android:
  - `FCM_SERVICE_ACCOUNT_JSON` o `FCM_SERVICE_ACCOUNT_PATH`

- iOS:
  - El push remoto esta desactivado por defecto mientras `EXPO_PUBLIC_IOS_PUSH_ENABLED` no sea `1`.
  - Si mas adelante se reactiva APNs, vuelven a aplicar estas variables:
  - `APNS_AUTH_KEY_P8` o `APNS_AUTH_KEY_PATH` o `APNS_AUTH_KEY_P8_B64`
  - `APNS_KEY_ID`
  - `APNS_TEAM_ID`
  - `APNS_BUNDLE_ID`
  - `APNS_USE_SANDBOX=true` solo para development builds/debug en dispositivo

### EAS / TestFlight

- Este proyecto ya queda preparado para compilar iOS en la nube con EAS desde Windows mediante `frontend/eas.json`.
- Antes del primer build en Expo/EAS, crea el environment `production` con estas variables:
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_OSRM_BASE_URL`
  - `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
  - `MAPBOX_DOWNLOADS_TOKEN`
  - `EXPO_PUBLIC_IOS_PUSH_ENABLED=0` mientras el push iOS siga pausado
- Si luego quieres builds internas de prueba en lugar de App Store Connect, usa el environment `preview` con las mismas variables.

## Build en Mac

## Requisito de toolchain

- Este frontend usa Expo SDK 54 + React Native 0.81.
- Esa combinacion requiere Xcode 16.1 o superior para compilar iOS.
- Una Mac en macOS Big Sur 11.7.11 con Xcode 13.2.1 no puede exportar este proyecto en su estado actual.
- Antes de pedir los comandos finales de exportacion hay que resolver uno de estos caminos:
  - usar una Mac compatible con Xcode 16.1+
  - o bajar el stack de Expo/React Native a versiones antiguas compatibles con Xcode 13, lo cual es una migracion aparte

## Flujo cuando el toolchain sea compatible

1. Instalar dependencias en `frontend/`.
2. Colocar `GoogleService-Info.plist` en `frontend/` si lo vas a usar.
3. Exportar `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` o mantener `MAPBOX_DOWNLOADS_TOKEN`.
4. Ejecutar `npx expo prebuild --platform ios`.
5. Ejecutar `npx expo run:ios --device` o abrir `ios/*.xcworkspace` en Xcode.

## Flujo TestFlight sin Mac local

1. En `frontend/`, iniciar sesion en Expo: `npx eas-cli login`.
2. Vincular el proyecto si Expo lo pide en el primer uso de EAS.
3. Confirmar que el environment `production` tenga cargadas las variables publicas y el token de descargas de Mapbox.
4. Lanzar el build para App Store Connect: `npm run ios:testflight:build`.
5. Cuando EAS termine, enviar el `.ipa` a TestFlight: `npm run ios:testflight:submit`.

No hace falta una Mac para ese flujo en la nube, pero si hacen falta una cuenta Expo y una cuenta Apple Developer activas.

## Notas importantes

- En esta iteracion, iOS no intenta registrar push remoto salvo que definas `EXPO_PUBLIC_IOS_PUSH_ENABLED=1`.
- Sin APNs no hay avisos equivalentes a Android con la app cerrada; el objetivo actual es foreground realtime estable.
- Push remoto iOS no funciona en simulator; prueba en iPhone fisico.
- `watchPositionAsync` sigue siendo foreground-only en iOS, pero ahora el chofer usa `startLocationUpdatesAsync` en background para seguir reportando ubicacion cuando la app queda minimizada.
- En iPhone, el chofer debe aceptar el permiso `Always` para que el tracking en segundo plano funcione.
- La config actual ya no agrega `remote-notification` en iOS porque el push quedo pausado.
- El bundle identifier actual esperado por backend/APNs es `com.star.trasladossc`.