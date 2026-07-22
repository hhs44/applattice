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

docker load --input (Join-Path $bundle "platform-images.tar")
Assert-CommandSucceeded "docker load"
Set-Location $bundle
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}
docker compose -f compose.yaml up -d --no-build
Assert-CommandSucceeded "docker compose up"

Write-Host "The platform is running at http://localhost:8080"
