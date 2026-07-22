param(
  [string]$Registry = ""
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
Set-Location $workspace

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

if ($Registry) {
  $env:npm_config_registry = $Registry
  Write-Host "Using internal npm registry: $Registry"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found. Install Node.js 22 or later."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm was not found. Run corepack enable first."
}

pnpm install --frozen-lockfile
Assert-CommandSucceeded "pnpm install"
pnpm typecheck
Assert-CommandSucceeded "typecheck"
pnpm test
Assert-CommandSucceeded "test"
pnpm build
Assert-CommandSucceeded "build"

Write-Host "Bootstrap completed. Run pnpm dev to start the development stack."
