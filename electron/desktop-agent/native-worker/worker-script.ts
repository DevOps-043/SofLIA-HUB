import { WORKER_RESPONSE_SENTINEL } from './worker-protocol';

/**
 * Script de arranque del worker persistente de PowerShell.
 *
 * Se escribe a un archivo temporal y se ejecuta con `powershell -File`, de modo
 * que STDIN queda libre para el protocolo de peticiones (una línea JSON por
 * petición). El script compila los ensamblados UIA y las nativas de user32 UNA
 * sola vez y luego atiende en bucle, escribiendo cada respuesta como
 * `##SOFLIA##{json}` en una sola línea.
 *
 * No usa `-EncodedCommand` ni `-Command`, así que no hay límite de longitud ni
 * aplanado de saltos de línea.
 */
export const POWERSHELL_WORKER_SCRIPT = `
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$sentinel = '${WORKER_RESPONSE_SENTINEL}'

$nativeSrc = @'
using System;
using System.Runtime.InteropServices;
namespace SofliaWorker {
  public static class Native {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  }
}
'@
Add-Type -TypeDefinition $nativeSrc

function Get-NormalizedName([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return '' }
  $d = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $d.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  ($sb.ToString().ToLowerInvariant() -replace '\\s+', ' ').Trim()
}

function Get-ForegroundElements([int]$sparseThreshold, [int]$wakeDelayMs) {
  $hwnd = [SofliaWorker.Native]::GetForegroundWindow()
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  if ($null -eq $root) { return @() }
  $cond = [System.Windows.Automation.Condition]::TrueCondition
  $scope = [System.Windows.Automation.TreeScope]::Descendants
  $elements = $root.FindAll($scope, $cond)
  # Despertar de accesibilidad: Chromium/Java construyen el arbol DESPUES de la
  # primera consulta. Si vino casi vacio, esperar y reconsultar.
  if ($elements.Count -lt $sparseThreshold -and $wakeDelayMs -gt 0) {
    Start-Sleep -Milliseconds $wakeDelayMs
    $root = [System.Windows.Automation.AutomationElement]::FromHandle([SofliaWorker.Native]::GetForegroundWindow())
    if ($null -ne $root) { $elements = $root.FindAll($scope, $cond) }
  }
  return $elements
}

function Collect-NamedElements($elements, [int]$maxElements) {
  $result = New-Object System.Collections.ArrayList
  $scanned = 0
  foreach ($el in $elements) {
    $scanned++
    if ($result.Count -ge $maxElements) { break }
    try {
      $name = $el.Current.Name
      if ([string]::IsNullOrWhiteSpace($name)) { continue }
      $rect = $el.Current.BoundingRectangle
      if ($rect.Width -le 0 -or $rect.Height -le 0 -or $el.Current.IsOffscreen) { continue }
      # Centro del rect: GetClickablePoint es una llamada cross-process costosa
      # (× cientos de elementos = segundos). El centro es suficiente para
      # clickear la gran mayoria de controles.
      $clickX = [int]($rect.X + ($rect.Width / 2))
      $clickY = [int]($rect.Y + ($rect.Height / 2))
      $ctype = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\\.', ''
      [void]$result.Add([PSCustomObject]@{
        name = $name
        controlType = $ctype
        rect = [PSCustomObject]@{ x = [int]$rect.X; y = [int]$rect.Y; width = [int]$rect.Width; height = [int]$rect.Height }
        clickX = $clickX
        clickY = $clickY
      })
    } catch {}
  }
  return [PSCustomObject]@{ elements = $result; scanned = $scanned }
}

function Write-Response($obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 6
  [Console]::Out.WriteLine($sentinel + $json)
  [Console]::Out.Flush()
}

# Loop principal: una peticion JSON por linea de stdin.
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq '') { continue }
  try {
    $req = $line | ConvertFrom-Json
    switch ($req.cmd) {
      'ping' {
        Write-Response ([PSCustomObject]@{ id = $req.id; ok = $true; cmd = 'ping'; pong = $true })
      }
      'locateByText' {
        $els = Get-ForegroundElements ([int]$req.sparseThreshold) ([int]$req.wakeDelayMs)
        $collected = Collect-NamedElements $els ([int]$req.maxElements)
        Write-Response ([PSCustomObject]@{ id = $req.id; ok = $true; cmd = 'locateByText'; elements = @($collected.elements); scanned = $collected.scanned })
      }
      'listElements' {
        $els = Get-ForegroundElements ([int]$req.sparseThreshold) ([int]$req.wakeDelayMs)
        $collected = Collect-NamedElements $els ([int]$req.maxElements)
        Write-Response ([PSCustomObject]@{ id = $req.id; ok = $true; cmd = 'listElements'; elements = @($collected.elements); scanned = $collected.scanned })
      }
      default {
        Write-Response ([PSCustomObject]@{ id = $req.id; ok = $false; error = ('Comando desconocido: ' + $req.cmd) })
      }
    }
  } catch {
    $errId = -1
    try { $errId = ($line | ConvertFrom-Json).id } catch {}
    Write-Response ([PSCustomObject]@{ id = $errId; ok = $false; error = $_.Exception.Message })
  }
}
`;
