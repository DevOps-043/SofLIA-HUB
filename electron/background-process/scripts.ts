export function encodeUtf16Base64(value: string): string {
  return Buffer.from(value, 'utf16le').toString('base64');
}

function encodeUtf8Base64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildBackgroundScript(command: string, workingDirectory: string | undefined, exitStatePath: string): string {
  const commandBase64 = encodeUtf8Base64(command);
  const workdirBase64 = encodeUtf8Base64(workingDirectory || '');
  const exitPathBase64 = encodeUtf8Base64(exitStatePath);
  return [
    "$ErrorActionPreference = 'Continue'",
    `$commandText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${commandBase64}'))`,
    `$workingDirectory = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${workdirBase64}'))`,
    `$exitStatePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${exitPathBase64}'))`,
    '$exitCode = 0',
    '$success = $true',
    'try {',
    '  if ($workingDirectory) { Set-Location -LiteralPath $workingDirectory }',
    '  Invoke-Expression $commandText',
    '  $success = $?',
    '  if ($LASTEXITCODE -is [int]) { $exitCode = [int]$LASTEXITCODE }',
    '  elseif (-not $success) { $exitCode = 1 }',
    '  else { $exitCode = 0 }',
    '} catch {',
    '  Write-Error $_',
    '  $exitCode = 1',
    '}',
    "$payload = @{ exitCode = $exitCode; finishedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress",
    "Set-Content -LiteralPath $exitStatePath -Value $payload -Encoding UTF8",
    'exit $exitCode',
  ].join('\n');
}

export function buildVisibleTerminalScript(command: string, workingDirectory?: string): string {
  const commandBase64 = encodeUtf8Base64(command);
  const workdirBase64 = encodeUtf8Base64(workingDirectory || '');
  return [
    `$commandText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${commandBase64}'))`,
    `$workingDirectory = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${workdirBase64}'))`,
    'if ($workingDirectory) { Set-Location -LiteralPath $workingDirectory }',
    'Invoke-Expression $commandText',
  ].join('\n');
}
