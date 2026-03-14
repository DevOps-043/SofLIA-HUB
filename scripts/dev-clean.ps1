param(
  [int[]]$Ports = @(5173, 5174, 5175)
)

$ErrorActionPreference = "SilentlyContinue"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$killed = New-Object System.Collections.Generic.List[object]
$seen = New-Object System.Collections.Generic.HashSet[int]

function Stop-TrackedProcess {
  param(
    [int]$Pid,
    [string]$Reason
  )

  if ($Pid -le 0 -or $Pid -eq $PID) {
    return
  }

  if (-not $seen.Add($Pid)) {
    return
  }

  $proc = Get-Process -Id $Pid -ErrorAction SilentlyContinue
  if (-not $proc) {
    return
  }

  try {
    Stop-Process -Id $Pid -Force -ErrorAction Stop
    $killed.Add([pscustomobject]@{
      Id     = $Pid
      Name   = $proc.ProcessName
      Reason = $Reason
    }) | Out-Null
    Write-Host "[dev-clean] Killed $($proc.ProcessName) ($Pid) - $Reason"
  } catch {
    Write-Host "[dev-clean] Failed to kill PID $Pid - $Reason"
  }
}

function Test-WorkspaceMatch {
  param(
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  return $Text -like "*$workspace*"
}

$electronProcesses = Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'"
foreach ($proc in $electronProcesses) {
  if ((Test-WorkspaceMatch $proc.ExecutablePath) -or (Test-WorkspaceMatch $proc.CommandLine)) {
    Stop-TrackedProcess -Pid $proc.ProcessId -Reason "electron process for this workspace"
  }
}

$nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
foreach ($proc in $nodeProcesses) {
  $cmd = $proc.CommandLine
  if ((Test-WorkspaceMatch $cmd) -and ($cmd -match "vite|electron|dist-electron|soflia-hub-desktop")) {
    Stop-TrackedProcess -Pid $proc.ProcessId -Reason "node dev process for this workspace"
  }
}

foreach ($port in $Ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $owningPid = $connection.OwningProcess
    if ($owningPid -le 0) {
      continue
    }

    $procInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $owningPid"
    if ((Test-WorkspaceMatch $procInfo.CommandLine) -or (Test-WorkspaceMatch $procInfo.ExecutablePath)) {
      Stop-TrackedProcess -Pid $owningPid -Reason "listening on dev port $port"
    }
  }
}

if ($killed.Count -eq 0) {
  Write-Host "[dev-clean] No matching node/electron processes found for this workspace."
  exit 0
}

Write-Host ""
Write-Host "[dev-clean] Finished. Processes stopped: $($killed.Count)"
$killed | Sort-Object Name, Id | Format-Table -AutoSize
