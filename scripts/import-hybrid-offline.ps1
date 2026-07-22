param(
  [string]$BundlePath = "."
)

$ErrorActionPreference = "Stop"
$bundle = [System.IO.Path]::GetFullPath($BundlePath)

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

foreach ($required in @("platform-images.tar", "compose.platform.yaml", "compose.services.yaml", ".env.example")) {
  if (-not (Test-Path (Join-Path $bundle $required))) {
    throw "Offline bundle is incomplete; missing: $required"
  }
}

docker load --input (Join-Path $bundle "platform-images.tar")
Assert-CommandSucceeded "docker load"
Set-Location $bundle
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}
docker compose --env-file .env -f compose.platform.yaml -f compose.services.yaml up -d --no-build
Assert-CommandSucceeded "docker compose up"

Write-Host "The hybrid platform is running at http://localhost:8080"
