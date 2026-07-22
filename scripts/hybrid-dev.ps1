param(
  [ValidateSet("up", "down", "config", "pull")]
  [string]$Action = "up",
  [switch]$LocalBuild,
  [string]$ReleaseManifest = ""
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$generated = Join-Path $workspace ".generated"

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

Set-Location $workspace
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

switch ($Action) {
  "up" {
    if ($LocalBuild) {
      docker @composeArgs up -d --build
    } else {
      docker @composeArgs up -d
    }
  }
  "down" { docker @composeArgs down }
  "config" { docker @composeArgs config }
  "pull" { docker @composeArgs pull }
}
Assert-CommandSucceeded "docker compose $Action"
