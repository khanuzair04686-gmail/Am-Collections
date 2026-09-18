# Portable Node.js Installer & Runner for AM COLLECTION
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$nodeDir = "C:\Users\DELL\nodejs_portable"
$nodeExe = Join-Path $nodeDir "node.exe"

if (-not (Test-Path $nodeExe)) {
    Write-Host ">>> Step 1/3: Downloading portable Node.js LTS (v20.18.0)..." -ForegroundColor Cyan
    $zipUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
    $tempZip = Join-Path $env:TEMP "node_lts.zip"
    
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($zipUrl, $tempZip)
    
    Write-Host ">>> Step 2/3: Extracting Node.js..." -ForegroundColor Cyan
    $tempExtract = Join-Path $env:TEMP "node_extract"
    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
    
    if (-not (Test-Path $nodeDir)) { New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null }
    
    $extractedFolder = Get-ChildItem $tempExtract | Select-Object -First 1
    Copy-Item -Path "$($extractedFolder.FullName)\*" -Destination $nodeDir -Recurse -Force
    
    # Cleanup
    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host ">>> Node.js successfully installed to: $nodeDir" -ForegroundColor Green
} else {
    Write-Host ">>> Node.js is already available at: $nodeDir" -ForegroundColor Green
}

# Add to User PATH persistently
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$nodeDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$nodeDir;$currentPath", "User")
    Write-Host ">>> Added Node.js to User PATH" -ForegroundColor Green
}

# Update current session PATH
$env:Path = "$nodeDir;" + $env:Path

Write-Host ">>> Step 3/3: Verifying Node & NPM..." -ForegroundColor Cyan
& "$nodeDir\node.exe" -v
& "$nodeDir\npm.cmd" -v

# Install dependencies if needed
Set-Location "E:\Am Collections"
if (-not (Test-Path "node_modules")) {
    Write-Host ">>> Installing project dependencies (express, mongoose, multer, cors, dotenv)..." -ForegroundColor Yellow
    & "$nodeDir\npm.cmd" install
}

Write-Host ">>> Launching AM COLLECTION Backend (npm run dev)..." -ForegroundColor Green
& "$nodeDir\npm.cmd" run dev
