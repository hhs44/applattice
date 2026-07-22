param(
  [Parameter(Mandatory = $true)]
  [string]$StorePath
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$store = [System.IO.Path]::GetFullPath($StorePath)

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $store)) {
  throw "The offline pnpm store does not exist: $store"
}

Set-Location $workspace
pnpm install --offline --frozen-lockfile --store-dir $store
Assert-CommandSucceeded "offline pnpm install"
pnpm typecheck
Assert-CommandSucceeded "typecheck"
pnpm test
Assert-CommandSucceeded "test"

Write-Host "Offline development setup completed. Run pnpm dev to start."
