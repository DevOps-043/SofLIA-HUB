// Nivel B: texto de la ventana por UI Automation, a partir de su pid.
//
// Deliberadamente separado de `desktop-agent/ui-elements-script.ts`. Aquel parte
// de `GetForegroundWindow` y filtra a 60 elementos INTERACTIVOS: sirve para
// decidir donde hacer clic, no para leer un documento, y obligaria a traer al
// frente cada ventana marcada. Son dos propositos distintos sobre la misma
// tecnologia y mezclarlos degradaria el agente de escritorio.
//
// `AutomationElement.FromHandle` no altera el foco: el usuario no ve nada.

import { DESKTOP_CONTEXT_LIMITS } from './types';
import { parseJsonOutput, runEncodedPowerShell, type EncodedPowerShell } from './powershell';

export interface UiaTextResult {
  text: string;
  /** Via concreta que entrego el texto; util para diagnostico. */
  source: string;
}

function buildScript(pid: number, maxChars: number): string {
  return `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$ErrorActionPreference = 'SilentlyContinue'
$maxChars = ${maxChars}
$proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($null -eq $proc) { Write-Output '{"text":"","source":"sin_proceso"}'; exit }
$hwnd = $proc.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) { Write-Output '{"text":"","source":"sin_ventana"}'; exit }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
if ($null -eq $root) { Write-Output '{"text":"","source":"sin_raiz"}'; exit }

$sb = New-Object System.Text.StringBuilder
$source = 'ninguno'

$tp = $null
if ($root.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$tp) -and $tp) {
  $texto = $tp.DocumentRange.GetText($maxChars)
  if (-not [string]::IsNullOrWhiteSpace($texto)) {
    [void]$sb.Append($texto)
    $source = 'texto_raiz'
  }
}

if ($sb.Length -eq 0) {
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsTextPatternAvailableProperty, $true)
  foreach ($node in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)) {
    if ($sb.Length -ge $maxChars) { break }
    $ntp = $null
    if ($node.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$ntp) -and $ntp) {
      $trozo = $ntp.DocumentRange.GetText($maxChars - $sb.Length)
      if (-not [string]::IsNullOrWhiteSpace($trozo)) { [void]$sb.AppendLine($trozo.Trim()) }
    }
  }
  if ($sb.Length -gt 0) { $source = 'texto_descendientes' }
}

if ($sb.Length -eq 0) {
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsOffscreenProperty, $false)
  $filas = @()
  foreach ($node in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)) {
    $nombre = $node.Current.Name
    if ([string]::IsNullOrWhiteSpace($nombre)) { continue }
    $rect = $node.Current.BoundingRectangle
    if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }
    $filas += [PSCustomObject]@{ y = [int]$rect.Y; x = [int]$rect.X; nombre = $nombre }
  }
  $previo = ''
  foreach ($fila in ($filas | Sort-Object y, x)) {
    if ($sb.Length -ge $maxChars) { break }
    if ($fila.nombre -eq $previo) { continue }
    [void]$sb.AppendLine($fila.nombre)
    $previo = $fila.nombre
  }
  if ($sb.Length -gt 0) { $source = 'nombres' }
}

ConvertTo-Json -InputObject ([PSCustomObject]@{ text = $sb.ToString(); source = $source }) -Compress -Depth 2
`;
}

/**
 * Texto legible de la ventana del proceso indicado. Devuelve texto vacio cuando
 * la aplicacion no expone nada por accesibilidad; el orquestador degrada a
 * captura en ese caso.
 */
export async function extractWindowText(
  pid: number,
  ps: EncodedPowerShell = runEncodedPowerShell,
  maxChars = DESKTOP_CONTEXT_LIMITS.maxCharsPerApp,
): Promise<UiaTextResult> {
  if (process.platform !== 'win32') return { text: '', source: 'plataforma_no_soportada' };
  if (!Number.isInteger(pid) || pid <= 0) return { text: '', source: 'pid_invalido' };

  try {
    const stdout = await ps(buildScript(pid, maxChars), DESKTOP_CONTEXT_LIMITS.uiaTimeoutMs);
    const parsed = parseJsonOutput<UiaTextResult>(stdout);
    if (!parsed || typeof parsed.text !== 'string') return { text: '', source: 'sin_respuesta' };
    return { text: parsed.text.trim(), source: String(parsed.source ?? 'desconocido') };
  } catch (error) {
    console.warn('[ContextoEscritorio] UI Automation no entrego texto:', toMessage(error));
    return { text: '', source: 'error' };
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
