param(
  [switch]$SkipBuild,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$service = Join-Path $workspace "service-workspaces/todo-list-service"
$runtime = Join-Path $workspace ".tmp/local-todo-runtime"
$statePath = Join-Path $runtime "processes.json"
$python = Join-Path $service ".venv/Scripts/python.exe"
$uv = Join-Path $service ".venv/Scripts/uv.exe"
$vite = Join-Path $workspace "apps/portal/node_modules/vite/bin/vite.js"
$todoFrontend = Join-Path $service "frontend"
$todoVite = Join-Path $todoFrontend "node_modules/vite/bin/vite.js"

function Normalize-ProcessPathEnvironment {
  $environment = [System.Environment]::GetEnvironmentVariables("Process")
  $pathKeys = @($environment.Keys | Where-Object {
    [string]::Equals([string]$_, "Path", [System.StringComparison]::OrdinalIgnoreCase)
  })
  if ($pathKeys.Count -le 1) {
    return
  }

  # Some automation hosts provide both Path and PATH. Windows PowerShell 5.1
  # Start-Process treats that as a duplicate dictionary key and refuses to run.
  $pathValue = @($pathKeys | ForEach-Object { [string]$environment[$_] }) -join ";"
  foreach ($pathKey in $pathKeys) {
    [System.Environment]::SetEnvironmentVariable([string]$pathKey, $null, "Process")
  }
  [System.Environment]::SetEnvironmentVariable("Path", $pathValue, "Process")
}

Normalize-ProcessPathEnvironment

function Assert-CommandSucceeded([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

function Wait-Http([string]$Url, [string]$Name) {
  for ($attempt = 1; $attempt -le 60; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  throw "$Name did not become ready: $Url"
}

function Stop-LocalProcessTree([int]$TargetProcessId) {
  $childProcesses = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $TargetProcessId" -ErrorAction SilentlyContinue)
  foreach ($childProcess in $childProcesses) {
    Stop-LocalProcessTree ([int]$childProcess.ProcessId)
  }
  Stop-Process -Id $TargetProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $statePath) {
  throw "A local Todo runtime state file already exists. Run scripts/stop-local-todo.ps1 first."
}
foreach ($required in @($python, $uv, $vite, $todoVite)) {
  if (-not (Test-Path $required)) {
    throw "Required local runtime file is missing: $required"
  }
}
$node = Get-Command node -ErrorAction Stop
$pnpm = Get-Command pnpm -ErrorAction Stop

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Set-Location $workspace
if (-not $SkipBuild) {
  & $pnpm.Source contracts:verify
  Assert-CommandSucceeded "contract verification"
  & $pnpm.Source build
  Assert-CommandSucceeded "platform build"
  & $pnpm.Source --dir $todoFrontend build
  Assert-CommandSucceeded "Todo frontend build"
}
if (-not $SkipTests) {
  Push-Location $service
  try {
    $env:UV_CACHE_DIR = Join-Path $service ".uv-cache"
    & $uv run ruff check .
    Assert-CommandSucceeded "Todo service Ruff"
    & $uv run mypy src
    Assert-CommandSucceeded "Todo service mypy"
    & $uv run pytest -q
    Assert-CommandSucceeded "Todo service tests"
    & $pnpm.Source --dir $todoFrontend typecheck
    Assert-CommandSucceeded "Todo frontend typecheck"
    & $pnpm.Source --dir $todoFrontend test
    Assert-CommandSucceeded "Todo frontend tests"
  } finally {
    Pop-Location
  }
}

$catalog = Get-Content -Raw -Encoding UTF8 (Join-Path $workspace "platform/service-catalog.json") | ConvertFrom-Json
$upstreams = [ordered]@{}
foreach ($entry in $catalog.services) {
  $upstreams[$entry.id] = [ordered]@{
    baseUrl = $entry.gateway.developmentUrl
    healthPath = $entry.gateway.healthPath
    requestTimeoutMs = $entry.gateway.requestTimeoutMs
    required = $entry.gateway.required
  }
}

$appCatalog = Get-Content -Raw -Encoding UTF8 (Join-Path $workspace "platform/app-catalog.json") | ConvertFrom-Json
$apps = [ordered]@{}
foreach ($entry in $appCatalog.apps) {
  $apps[$entry.id] = [ordered]@{
    id = $entry.id
    title = $entry.title
    description = $entry.description
    route = $entry.route
    navMark = $entry.navMark
    requiredPermission = $entry.requiredPermission
    frontend = [ordered]@{
      version = $entry.frontend.version
      remoteName = $entry.frontend.remoteName
      module = $entry.frontend.module
      bridgeVersion = $entry.frontend.bridgeVersion
      manifestPath = $entry.frontend.manifestPath
      baseUrl = $entry.frontend.developmentUrl
      requestTimeoutMs = $entry.frontend.requestTimeoutMs
    }
    backend = $entry.backend
    permissions = $entry.permissions
  }
}

$started = @()
function Start-LocalProcess(
  [string]$Name,
  [string]$FilePath,
  [string[]]$ArgumentList,
  [string]$WorkingDirectory
) {
  $stdout = Join-Path $runtime "$Name.out.log"
  $stderr = Join-Path $runtime "$Name.err.log"
  $process = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru
  $script:started += $process
  return $process
}

try {
  $env:NODE_ENV = "development"
  $env:DOMAIN_SERVICE_PORT = "4100"
  Start-LocalProcess "domain" $node.Source @("apps/domain-service/dist/server.js") $workspace | Out-Null
  Wait-Http "http://127.0.0.1:4100/health/ready" "Domain service"

  $env:SERVICE_NAME = "todo-list-service"
  $env:SERVICE_PORT = "4200"
  $env:TODO_DATABASE_PATH = Join-Path $service ".data/todos.db"
  $env:PYTHONUNBUFFERED = "1"
  Start-LocalProcess "todo" $python @("-m", "service.main") $service | Out-Null
  Wait-Http "http://127.0.0.1:4200/health/ready" "Todo service"

  Start-LocalProcess "todo-web" $node.Source @($todoVite, "preview", "--host", "127.0.0.1", "--port", "4300") $todoFrontend | Out-Null
  Wait-Http "http://127.0.0.1:4300/modules/todo-list/mf-manifest.json" "Todo frontend"

  $env:AUTH_MODE = "dev"
  $env:GATEWAY_PORT = "4000"
  $env:PORTAL_ORIGIN = "http://127.0.0.1:8080"
  $env:UPSTREAMS_JSON = $upstreams | ConvertTo-Json -Compress -Depth 5
  $env:APP_CATALOG_JSON = $apps | ConvertTo-Json -Compress -Depth 8
  Start-LocalProcess "gateway" $node.Source @("apps/gateway/dist/server.js") $workspace | Out-Null
  Wait-Http "http://127.0.0.1:4000/health/ready" "Gateway"

  Start-LocalProcess "portal" $node.Source @($vite, "preview", "--host", "127.0.0.1", "--port", "8080") (Join-Path $workspace "apps/portal") | Out-Null
  Wait-Http "http://127.0.0.1:8080/" "Portal"

  $state = [ordered]@{
    startedAt = [DateTime]::UtcNow.ToString("o")
    urls = [ordered]@{
      portal = "http://127.0.0.1:8080"
      gateway = "http://127.0.0.1:4000"
      todo = "http://127.0.0.1:4200"
      todoWeb = "http://127.0.0.1:4300/modules/todo-list/"
    }
    processes = @($started | ForEach-Object {
      [ordered]@{
        id = $_.Id
        name = $_.ProcessName
        startedAt = $_.StartTime.ToUniversalTime().ToString("o")
      }
    })
  }
  $state | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $statePath
  Write-Host "Local Todo stack is ready: http://127.0.0.1:8080"
  Write-Host "Stop it with: .\scripts\stop-local-todo.ps1"
} catch {
  foreach ($process in $started) {
    if (-not $process.HasExited) {
      Stop-LocalProcessTree $process.Id
    }
  }
  throw
}
