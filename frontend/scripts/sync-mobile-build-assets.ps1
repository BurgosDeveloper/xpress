$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoRoot = Resolve-Path (Join-Path $projectRoot '..')
$appJsonPath = Join-Path $projectRoot 'app.json'
$androidDir = Join-Path $projectRoot 'android'
$assetsDir = Join-Path $projectRoot 'assets'

$appConfig = Get-Content -Raw -Path $appJsonPath | ConvertFrom-Json
$expoConfig = $appConfig.expo
$appName = [string]$expoConfig.name
$appVersion = [string]$expoConfig.version
$androidVersionCode = [int]$expoConfig.android.versionCode

function Set-FileContentIfChanged {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $existing = if (Test-Path $Path) { Get-Content -Raw -Path $Path } else { $null }
  if ($existing -cne $Content) {
    Set-Content -Path $Path -Encoding ASCII -Value $Content
  }
}

function Save-ResizedPng {
  param(
    [Parameter(Mandatory = $true)][System.Drawing.Image]$SourceImage,
    [Parameter(Mandatory = $true)][string]$DestinationPath,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($SourceImage, 0, 0, $Width, $Height)
    }
    finally {
      $graphics.Dispose()
    }

    if (Test-Path $DestinationPath) {
      Remove-Item -Force $DestinationPath
    }

    $bitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $bitmap.Dispose()
  }
}

function Sync-BrandingAssets {
  $uploadDir = Join-Path $repoRoot 'backend\upload'
  if (!(Test-Path $uploadDir)) {
    return
  }

  $logoSource = Join-Path $uploadDir 'logo_xpress.png'
  $iconSource = Join-Path $uploadDir 'incon.png'
  $logoDestination = Join-Path $assetsDir 'logo_xpress.png'
  $iconDestination = Join-Path $assetsDir 'icon.png'

  if (Test-Path $logoSource) {
    Copy-Item -Force -Path $logoSource -Destination $logoDestination
  }

  if (Test-Path $iconSource) {
    Copy-Item -Force -Path $iconSource -Destination $iconDestination
  }
}

function Sync-FirebaseConfigs {
  $rootGoogleServices = Join-Path $repoRoot 'google-services.json'
  $frontendGoogleServices = Join-Path $projectRoot 'google-services.json'
  $androidGoogleServices = Join-Path $androidDir 'app\google-services.json'

  if (Test-Path $rootGoogleServices) {
    Copy-Item -Force -Path $rootGoogleServices -Destination $frontendGoogleServices
    if (Test-Path $androidDir) {
      Copy-Item -Force -Path $rootGoogleServices -Destination $androidGoogleServices
    }
  }

  $rootGoogleServiceInfo = Join-Path $repoRoot 'GoogleService-Info.plist'
  $frontendGoogleServiceInfo = Join-Path $projectRoot 'GoogleService-Info.plist'
  if (Test-Path $rootGoogleServiceInfo) {
    Copy-Item -Force -Path $rootGoogleServiceInfo -Destination $frontendGoogleServiceInfo
  }
}

function Sync-AndroidMetadata {
  if (!(Test-Path $androidDir)) {
    return
  }

  $buildGradlePath = Join-Path $androidDir 'app\build.gradle'
  if (Test-Path $buildGradlePath) {
    $buildGradle = Get-Content -Raw -Path $buildGradlePath
    $buildGradle = $buildGradle -replace '(?m)^\s*versionCode\s+\d+\s*$', "        versionCode $androidVersionCode"
    $buildGradle = $buildGradle -replace '(?m)^\s*versionName\s+"[^"]+"\s*$', "        versionName `"$appVersion`""
    Set-Content -Path $buildGradlePath -Encoding ASCII -Value $buildGradle
  }

  $stringsPath = Join-Path $androidDir 'app\src\main\res\values\strings.xml'
  if (Test-Path $stringsPath) {
    $escapedName = [System.Security.SecurityElement]::Escape($appName)
    $strings = Get-Content -Raw -Path $stringsPath
    $strings = $strings -replace '<string name="app_name">.*?</string>', ('<string name="app_name">' + $escapedName + '</string>')
    Set-Content -Path $stringsPath -Encoding UTF8 -Value $strings
  }
}

function Sync-AndroidSounds {
  if (!(Test-Path $androidDir)) {
    return
  }

  $rawDir = Join-Path $androidDir 'app\src\main\res\raw'
  New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

  $soundsDir = Join-Path $assetsDir 'notifications'
  if (Test-Path $soundsDir) {
    $sounds = Get-ChildItem -Path $soundsDir -Filter *.mp3 -File -ErrorAction SilentlyContinue
    if ($sounds -and $sounds.Count -gt 0) {
      Copy-Item -Force -Path (Join-Path $soundsDir '*.mp3') -Destination $rawDir
    }
  }
}

function Sync-AndroidLauncherAssets {
  if (!(Test-Path $androidDir)) {
    return
  }

  Add-Type -AssemblyName System.Drawing
  $iconPath = Join-Path $assetsDir 'icon.png'
  if (!(Test-Path $iconPath)) {
    throw "No existe el icono esperado en: $iconPath"
  }

  $iconImage = [System.Drawing.Image]::FromFile($iconPath)
  try {
    $mipmapSizes = @{
      'mipmap-mdpi' = @{ Launcher = 48; Foreground = 108 }
      'mipmap-hdpi' = @{ Launcher = 72; Foreground = 162 }
      'mipmap-xhdpi' = @{ Launcher = 96; Foreground = 216 }
      'mipmap-xxhdpi' = @{ Launcher = 144; Foreground = 324 }
      'mipmap-xxxhdpi' = @{ Launcher = 192; Foreground = 432 }
    }

    foreach ($entry in $mipmapSizes.GetEnumerator()) {
      $dir = Join-Path $androidDir "app\src\main\res\$($entry.Key)"
      New-Item -ItemType Directory -Force -Path $dir | Out-Null

      Get-ChildItem -Path $dir -Filter 'ic_launcher*.webp' -File -ErrorAction SilentlyContinue | Remove-Item -Force

      Save-ResizedPng -SourceImage $iconImage -DestinationPath (Join-Path $dir 'ic_launcher.png') -Width $entry.Value.Launcher -Height $entry.Value.Launcher
      Save-ResizedPng -SourceImage $iconImage -DestinationPath (Join-Path $dir 'ic_launcher_round.png') -Width $entry.Value.Launcher -Height $entry.Value.Launcher
      Save-ResizedPng -SourceImage $iconImage -DestinationPath (Join-Path $dir 'ic_launcher_foreground.png') -Width $entry.Value.Foreground -Height $entry.Value.Foreground
    }

    $splashSizes = @{
      'drawable-mdpi' = 288
      'drawable-hdpi' = 432
      'drawable-xhdpi' = 576
      'drawable-xxhdpi' = 864
      'drawable-xxxhdpi' = 1152
    }

    foreach ($entry in $splashSizes.GetEnumerator()) {
      $dir = Join-Path $androidDir "app\src\main\res\$($entry.Key)"
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
      Save-ResizedPng -SourceImage $iconImage -DestinationPath (Join-Path $dir 'splashscreen_logo.png') -Width $entry.Value -Height $entry.Value
    }
  }
  finally {
    $iconImage.Dispose()
  }
}

Sync-BrandingAssets
Sync-FirebaseConfigs
Sync-AndroidMetadata
Sync-AndroidSounds
Sync-AndroidLauncherAssets

[PSCustomObject]@{
  AppName = $appName
  Version = $appVersion
  AndroidVersionCode = $androidVersionCode
} | ConvertTo-Json -Depth 3