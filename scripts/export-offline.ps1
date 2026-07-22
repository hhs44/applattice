param(
  [string]$OutputPath = "offline-bundle"
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$bundle = [System.IO.Path]::GetFullPath((Join-Path $workspace $OutputPath))

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

New-Item -ItemType Directory -Force -Path $bundle | Out-Null

Set-Location $workspace
$fetchWorkspace = Join-Path $bundle "pnpm-fetch-workspace"
New-Item -ItemType Directory -Force -Path $fetchWorkspace | Out-Null
Copy-Item pnpm-lock.yaml (Join-Path $fetchWorkspace "pnpm-lock.yaml") -Force
Push-Location $fetchWorkspace
try {
  pnpm fetch --frozen-lockfile --store-dir (Join-Path $bundle "pnpm-store")
  Assert-CommandSucceeded "pnpm fetch"
} finally {
  Pop-Location
}
docker compose -f deployment/compose.yaml build
Assert-CommandSucceeded "docker compose build"
docker save --output (Join-Path $bundle "platform-images.tar") `
  intelligent-testing/portal:0.1.0 `
  intelligent-testing/gateway:0.1.0 `
  intelligent-testing/domain-service:0.1.0
Assert-CommandSucceeded "docker save"

Copy-Item deployment/compose.yaml (Join-Path $bundle "compose.yaml") -Force
Copy-Item deployment/.env.example (Join-Path $bundle ".env.example") -Force
Copy-Item scripts/import-offline.ps1 (Join-Path $bundle "import-offline.ps1") -Force

Write-Host "Offline images and the development dependency store were exported to: $bundle"
