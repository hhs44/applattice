$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $workspace ".tmp/local-todo-runtime/processes.json"

function Stop-LocalProcessTree([int]$TargetProcessId) {
  $childProcesses = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $TargetProcessId" -ErrorAction SilentlyContinue)
  foreach ($childProcess in $childProcesses) {
    Stop-LocalProcessTree ([int]$childProcess.ProcessId)
  }
  Stop-Process -Id $TargetProcessId -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $statePath)) {
  Write-Host "Local Todo stack is not running."
  exit 0
}

$state = Get-Content -Raw -Encoding UTF8 $statePath | ConvertFrom-Json
foreach ($record in $state.processes) {
  $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }
  $expected = [DateTime]::Parse($record.startedAt).ToUniversalTime()
  $actual = $process.StartTime.ToUniversalTime()
  if ($process.ProcessName -ne $record.name -or [Math]::Abs(($actual - $expected).TotalSeconds) -gt 2) {
    Write-Warning "PID $($record.id) no longer matches the recorded process; it was not stopped."
    continue
  }
  Stop-LocalProcessTree $process.Id
}

Remove-Item -LiteralPath $statePath
Write-Host "Local Todo stack stopped. Logs are preserved under .tmp/local-todo-runtime."
