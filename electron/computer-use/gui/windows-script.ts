/** Programa fijo: JSON Base64 por stdin, nunca código o línea de comando del modelo. */
export const WINDOWS_GUI_SCRIPT = String.raw`$ErrorActionPreference = 'Stop'
try {
  $data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd())) | ConvertFrom-Json
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,System.UIntPtr extra); [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,System.UIntPtr extra);' -Name Input -Namespace SofliaGui
  if ($data.action -eq 'type') { [System.Windows.Forms.SendKeys]::SendWait([string]$data.text); exit 0 }
  if ($data.action -eq 'key') {
    try { foreach ($key in $data.keys) { [SofliaGui.Input]::keybd_event([byte]$key,0,0,[UIntPtr]::Zero) } }
    finally { $keys = @($data.keys); [Array]::Reverse($keys); foreach ($key in $keys) { [SofliaGui.Input]::keybd_event([byte]$key,0,2,[UIntPtr]::Zero) } }
    exit 0
  }
  if ($data.action -eq 'left_click_drag') {
    try {
      [SofliaGui.Input]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
      [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new([int]$data.x,[int]$data.y)
    } finally { [SofliaGui.Input]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
    exit 0
  }
  [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new([int]$data.x,[int]$data.y)
  if ($data.action -eq 'mouse_move') { exit 0 }
  $down = 2; $up = 4
  if ($data.action -eq 'right_click') { $down = 8; $up = 16 }
  if ($data.action -eq 'middle_click') { $down = 32; $up = 64 }
  $count = 1; if ($data.action -eq 'double_click') { $count = 2 }
  for ($index = 0; $index -lt $count; $index++) {
    try { [SofliaGui.Input]::mouse_event($down,0,0,0,[UIntPtr]::Zero) }
    finally { [SofliaGui.Input]::mouse_event($up,0,0,0,[UIntPtr]::Zero) }
    if ($count -gt 1 -and $index -eq 0) { Start-Sleep -Milliseconds 50 }
  }
} catch { [Console]::Error.WriteLine('No se completó la entrada de escritorio.'); exit 1 }
`;
