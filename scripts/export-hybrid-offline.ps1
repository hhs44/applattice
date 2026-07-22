param(
  [string]$OutputPath = "offline-bundle-hybrid",
  [switch]$LocalBuild,
  [string]$ReleaseManifest = ""
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$bundle = [System.IO.Path]::GetFullPath((Join-Path $workspace $OutputPath))
$generated = Join-Path $workspace ".generated"

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

if (Test-Path $bundle) {
  throw "Output directory already exists; refusing to overwrite: $bundle"
}
New-Item -ItemType Directory -Path $bundle | Out-Null
Set-Location $workspace

$fetchWorkspace = Join-Path $bundle "pnpm-fetch-workspace"
New-Item -ItemType Directory -Path $fetchWorkspace | Out-Null
Copy-Item pnpm-lock.yaml (Join-Path $fetchWorkspace "pnpm-lock.yaml")
Push-Location $fetchWorkspace
try {
  pnpm fetch --frozen-lockfile --store-dir (Join-Path $bundle "pnpm-store")
  Assert-CommandSucceeded "pnpm fetch"
} finally {
  Pop-Location
}

if ($LocalBuild -and $ReleaseManifest) {
  throw "LocalBuild and ReleaseManifest cannot be used together"
} elseif ($LocalBuild) {
  node scripts/render-hybrid-config.mjs --local-build
} elseif ($ReleaseManifest) {
  node scripts/verify-release-manifest.mjs $ReleaseManifest
  Assert-CommandSucceeded "verify release manifest"
  node scripts/render-hybrid-config.mjs --release $ReleaseManifest
} else {
  node scripts/render-hybrid-config.mjs
}
Assert-CommandSucceeded "render hybrid configuration"

$composeArgs = @(
  "compose",
  "--env-file", (Join-Path $generated "hybrid.env"),
  "-f", (Join-Path $workspace "deployment/compose.platform.yaml"),
  "-f", (Join-Path $generated "compose.services.yaml")
)

if ($ReleaseManifest) {
  docker @composeArgs pull
  Assert-CommandSucceeded "pull release images"
} elseif ($LocalBuild) {
  docker @composeArgs build
  Assert-CommandSucceeded "build local platform and service images"
} else {
  docker @composeArgs build
  Assert-CommandSucceeded "build platform images"
  $catalog = Get-Content -Raw -Encoding UTF8 platform/service-catalog.json | ConvertFrom-Json
  foreach ($service in $catalog.services) {
    docker pull $service.deployment.image
    Assert-CommandSucceeded "pull service image $($service.id)"
  }
}

$images = @(docker @composeArgs config --images)
Assert-CommandSucceeded "resolve compose images"
if ($images.Count -eq 0) {
  throw "No images were resolved from the hybrid compose configuration"
}
docker save --output (Join-Path $bundle "platform-images.tar") $images
Assert-CommandSucceeded "docker save"

Copy-Item deployment/compose.platform.yaml (Join-Path $bundle "compose.platform.yaml")
Copy-Item (Join-Path $generated "compose.services.yaml") (Join-Path $bundle "compose.services.yaml")
Copy-Item (Join-Path $generated "hybrid.env") (Join-Path $bundle ".env.example")
Copy-Item platform/service-catalog.json (Join-Path $bundle "service-catalog.json")
Copy-Item platform/contracts.lock.json (Join-Path $bundle "contracts.lock.json")
Copy-Item scripts/import-hybrid-offline.ps1 (Join-Path $bundle "import-offline.ps1")

Write-Host "Hybrid runtime images, manifests and platform pnpm store exported to: $bundle"
