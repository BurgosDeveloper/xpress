$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path $studioJbr) {
  $env:JAVA_HOME = $studioJbr
  $env:Path = "$studioJbr\bin;" + $env:Path
}

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (!(Test-Path $sdkRoot)) {
  throw "No existe el Android SDK en: $sdkRoot. Ejecuta primero scripts\\setup-android-sdk.ps1"
}

$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

if (-not $env:NODE_ENV) {
  $env:NODE_ENV = 'development'
}

$syncScript = Join-Path $PSScriptRoot 'sync-mobile-build-assets.ps1'
& $syncScript | Out-Null

$androidDir = Resolve-Path (Join-Path $PSScriptRoot '..\android')

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

$localProps = Join-Path $androidDir 'local.properties'
"sdk.dir=$($sdkRoot -replace '\\','/')" | Set-Content -Encoding ASCII -Path $localProps

Push-Location $androidDir
try {
  .\gradlew.bat :app:assembleDebug --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle fallo con codigo $LASTEXITCODE. Revisa la salida arriba."
  }
}
finally {
  Pop-Location
}

$apk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  Write-Output "APK generado: $apk"
}
else {
  Write-Output "Build terminó, pero no encontré el APK esperado en: $apk"
}