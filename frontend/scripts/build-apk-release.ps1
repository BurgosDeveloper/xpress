$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path $studioJbr) {
  $env:JAVA_HOME = $studioJbr
  $env:Path = "$studioJbr\bin;" + $env:Path
}

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (!(Test-Path $sdkRoot)) {
  throw "No existe el Android SDK en: $sdkRoot. Ejecuta primero npm run android:setup-sdk"
}

$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

$env:NODE_ENV = 'production'

$syncScript = Join-Path $PSScriptRoot 'sync-mobile-build-assets.ps1'
$syncResult = & $syncScript | ConvertFrom-Json

# Load .env (if present) so Gradle can read MAPBOX_DOWNLOADS_TOKEN and app can read EXPO_PUBLIC_* vars.
$envFile = Resolve-Path -ErrorAction SilentlyContinue (Join-Path $PSScriptRoot '..\.env')
if ($envFile) {
  Get-Content -Path $envFile | ForEach-Object {
    $line = $_.Trim()
    if (!$line) { return }
    if ($line.StartsWith('#')) { return }
    $m = [regex]::Match($line, '^(?<k>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<v>.*)$')
    if (!$m.Success) { return }
    $k = $m.Groups['k'].Value
    $v = $m.Groups['v'].Value.Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($k) { Set-Item -Path "Env:$k" -Value $v }
  }
}

$androidDir = Resolve-Path (Join-Path $PSScriptRoot '..\android')

# Force-disable New Architecture for stability
$gradleProps = Join-Path $androidDir 'gradle.properties'
if (Test-Path $gradleProps) {
  $gp = Get-Content -Raw -Path $gradleProps
  if ($gp -match '(?m)^newArchEnabled=') {
    $gp = $gp -replace '(?m)^newArchEnabled=.*$', 'newArchEnabled=false'
  }
  else {
    $gp = $gp.TrimEnd() + "`nnewArchEnabled=false`n"
  }
  Set-Content -Encoding ASCII -Path $gradleProps -Value $gp
}

# Point Gradle to the local SDK
$localProps = Join-Path $androidDir 'local.properties'
"sdk.dir=$($sdkRoot -replace '\\','/')" | Set-Content -Encoding ASCII -Path $localProps

$releaseSigningConfigured =
  [bool](($env:XPRESS_UPLOAD_STORE_FILE) -or (Get-ChildItem Env: | Where-Object { $_.Name -eq 'XPRESS_UPLOAD_STORE_FILE' })) -and
  [bool](($env:XPRESS_UPLOAD_STORE_PASSWORD) -or (Get-ChildItem Env: | Where-Object { $_.Name -eq 'XPRESS_UPLOAD_STORE_PASSWORD' })) -and
  [bool](($env:XPRESS_UPLOAD_KEY_ALIAS) -or (Get-ChildItem Env: | Where-Object { $_.Name -eq 'XPRESS_UPLOAD_KEY_ALIAS' })) -and
  [bool](($env:XPRESS_UPLOAD_KEY_PASSWORD) -or (Get-ChildItem Env: | Where-Object { $_.Name -eq 'XPRESS_UPLOAD_KEY_PASSWORD' }))

if (-not $releaseSigningConfigured) {
  Write-Warning 'No detecté keystore release en variables XPRESS_UPLOAD_*. Gradle puede caer al debug keystore. Eso sirve para pruebas locales, pero revisa la firma antes de subir a Play Console.'
}

Push-Location $androidDir
try {
  .\gradlew.bat :app:clean :app:assembleRelease :app:bundleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle fallo con codigo $LASTEXITCODE. Revisa la salida arriba (por ej. tokens de Mapbox / dependencias)."
  }
}
finally {
  Pop-Location
}

$apk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
$aab = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
$exportDir = Resolve-Path -ErrorAction SilentlyContinue (Join-Path $PSScriptRoot '..\..\export')
if (!$exportDir) {
  $exportDir = (Join-Path $PSScriptRoot '..\..\export')
  New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
}

$safeBaseName = ($syncResult.AppName -replace '[^A-Za-z0-9]+', '_').Trim('_')
if (-not $safeBaseName) {
  $safeBaseName = 'app'
}
$artifactBaseName = "$safeBaseName-$($syncResult.Version)-$($syncResult.AndroidVersionCode)-release"

if (Test-Path $apk) {
  Write-Output "APK release generado: $apk"
  $apkDestination = Join-Path $exportDir "$artifactBaseName.apk"
  Copy-Item -Force -Path $apk -Destination $apkDestination
  Write-Output "Copiado APK a: $apkDestination"
}
else {
  Write-Output "Build terminó, pero no encontré el APK esperado en: $apk"
}

if (Test-Path $aab) {
  Write-Output "AAB release generado: $aab"
  $aabDestination = Join-Path $exportDir "$artifactBaseName.aab"
  Copy-Item -Force -Path $aab -Destination $aabDestination
  Write-Output "Copiado AAB a: $aabDestination"
}
else {
  Write-Output "Build terminó, pero no encontré el AAB esperado en: $aab"
}
