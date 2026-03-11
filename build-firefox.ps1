# Script de build pour Firefox (Archive ZIP requise)

$ZipName = "reels-party-firefox.zip"
$SourceDir = $PSScriptRoot
$Destination = Join-Path -Path $PSScriptRoot -ChildPath "..\" -Resolve | Join-Path -ChildPath $ZipName

Write-Host "📦 Préparation de l'archive pour Firefox..." -ForegroundColor Cyan

# 1. On supprime l'ancien ZIP s'il existe
if (Test-Path $Destination) {
    Remove-Item $Destination -Force
}

# 2. Liste des fichiers à inclure (on exclut server/ et les .git, .md, .ps1)
$FilesToZip = Get-ChildItem -Path $SourceDir | Where-Object { 
    $_.Name -ne "server" -and 
    $_.Name -ne ".git" -and
    $_.Name -ne "build-firefox.ps1" -and
    $_.Extension -ne ".md"
}

# 3. Compression
Compress-Archive -Path $FilesToZip.FullName -DestinationPath $Destination -CompressionLevel Optimal

Write-Host "✅ Terminé ! Le fichier '$ZipName' a été généré dans le dossier parent." -ForegroundColor Green
Write-Host "👉 Allez sur Firefox (about:debugging), cliquez sur 'Ce Firefox' -> 'Charger un module temporaire', et sélectionnez ce fichier zip." -ForegroundColor Yellow
