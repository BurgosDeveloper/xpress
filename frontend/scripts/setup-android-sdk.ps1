$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path $studioJbr) {
  $env:JAVA_HOME = $studioJbr
  $env:Path = "$studioJbr\bin;" + $env:Path
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw 'No encontré Java en PATH. Instala Android Studio (incluye JBR) o configura JAVA_HOME.'
}

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

$cmdlineLatest = Join-Path $sdkRoot 'cmdline-tools\latest'
$sdkmanager = Join-Path $cmdlineLatest 'bin\sdkmanager.bat'

function Install-CmdlineTools {
  param(
    [Parameter(Mandatory = $true)][string]$SdkRoot,
    [Parameter(Mandatory = $true)][string]$CmdlineLatest
  )

  $url = 'https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip'
  $zipPath = Join-Path $env:TEMP ("commandlinetools-win_{0}.zip" -f ([DateTime]::UtcNow.ToString('yyyyMMdd_HHmmss')))
  $tmpExtract = Join-Path $env:TEMP ("android_cmdline_extract_{0}" -f ([Guid]::NewGuid().ToString('N')))

  Write-Output "Downloading commandline-tools..."
  Invoke-WebRequest -Uri $url -OutFile $zipPath

  New-Item -ItemType Directory -Force -Path $tmpExtract | Out-Null
  Expand-Archive -Path $zipPath -DestinationPath $tmpExtract -Force

  $found = Get-ChildItem -Path $tmpExtract -Recurse -Filter 'sdkmanager.bat' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $found) { throw "sdkmanager.bat no encontrado dentro del zip extraído ($tmpExtract)" }

  $cmdlineRoot = $found.Directory.Parent.FullName
  if (Test-Path $CmdlineLatest) { Remove-Item -Recurse -Force $CmdlineLatest }
  New-Item -ItemType Directory -Force -Path $CmdlineLatest | Out-Null

  Copy-Item -Path (Join-Path $cmdlineRoot '*') -Destination $CmdlineLatest -Recurse -Force

  Remove-Item -Recurse -Force $tmpExtract
  Remove-Item -Force $zipPath
}

if (!(Test-Path $sdkmanager)) {
  Install-CmdlineTools -SdkRoot $sdkRoot -CmdlineLatest $cmdlineLatest
}

if (!(Test-Path $sdkmanager)) {
  throw "sdkmanager.bat no encontrado: $sdkmanager"
}

Write-Output "sdkmanager ready: $sdkmanager"

$packages = @(
  'platform-tools',
  'platforms;android-36',
  'build-tools;36.0.0',
  'ndk;27.1.12297006'
)

Write-Output "Accepting Android SDK licenses..."
(1..200 | ForEach-Object { 'y' }) | & $sdkmanager --sdk_root=$sdkRoot --licenses | Out-Null

Write-Output "Installing: $($packages -join ', ')"
& $sdkmanager --sdk_root=$sdkRoot @packages

Write-Output "Android SDK listo en: $sdkRoot"