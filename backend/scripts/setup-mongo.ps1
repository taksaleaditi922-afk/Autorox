param([switch]$Download)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$backendRoot = Split-Path -Parent $PSScriptRoot
$mongoVersion = '8.2.6'
$toolsDir = Join-Path $backendRoot '.tools'
$mongoDir = Join-Path $toolsDir "mongodb-$mongoVersion"
$mongoExe = Join-Path $mongoDir 'mongod.exe'
$dataDir = Join-Path $backendRoot 'data\mongodb'
$logDir = Join-Path $backendRoot 'logs'

if (-not (Test-Path -LiteralPath $mongoExe)) {
    if (-not $Download) { throw 'Local MongoDB is not installed. Run npm run db:setup from backend first.' }
    New-Item -ItemType Directory -Force -Path $mongoDir | Out-Null
    $archive = Join-Path $toolsDir "mongodb-$mongoVersion.zip"
    $downloadUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-$mongoVersion.zip"
    Write-Host "Downloading MongoDB $mongoVersion from mongodb.org..."
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archive -TimeoutSec 600
    $checksum = (Invoke-WebRequest -UseBasicParsing -Uri "$downloadUrl.sha256" -TimeoutSec 60).Content
    $expected = [regex]::Match([string]$checksum, '[a-fA-F0-9]{64}').Value
    if (-not $expected -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
        throw 'MongoDB download checksum verification failed.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $entry = $zip.Entries | Where-Object { $_.FullName -match '/bin/mongod.exe$' } | Select-Object -First 1
        if (-not $entry) { throw 'The MongoDB archive has no mongod.exe.' }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $mongoExe, $true)
    } finally { $zip.Dispose() }
    Remove-Item -LiteralPath $archive
    Write-Host 'MongoDB download verified and installed inside backend/.tools.'
}

# Back up the previous, stopped database before starting it in replica-set mode.
$backupMarker = Join-Path $backendRoot 'data\.replica-backup-complete'
if ((Test-Path -LiteralPath (Join-Path $dataDir 'WiredTiger')) -and -not (Test-Path -LiteralPath $backupMarker)) {
    $backupDir = Join-Path $backendRoot ('data\backups\mongodb-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Get-ChildItem -LiteralPath $dataDir -Force | Copy-Item -Destination $backupDir -Recurse
    Set-Content -LiteralPath $backupMarker -Value $backupDir
    Write-Host "Existing database backed up to $backupDir"
}

New-Item -ItemType Directory -Force -Path $dataDir,$logDir | Out-Null
$mongoLog = Join-Path $logDir 'mongodb.log'
$arguments = '--bind_ip 127.0.0.1 --port 27017 --replSet rs0 --oplogSize 128 --dbpath "' + $dataDir + '" --logpath "' + $mongoLog + '" --logappend'
$mongoProcess = Start-Process -FilePath $mongoExe -ArgumentList $arguments -WindowStyle Hidden -PassThru
Write-Host "Started MongoDB in the background (PID $($mongoProcess.Id))."
