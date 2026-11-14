param(
  [Parameter(Mandatory=$true)][ValidateSet('Check','SignFile','SignTree','VerifyFile','VerifyTree')][string]$Action,
  [string]$Target,
  [switch]$RequirePublisher
)
$ErrorActionPreference = 'Stop'

function Get-SignTool {
  if ($env:SOFLIA_SIGNTOOL_PATH) {
    $tool = Get-Item -LiteralPath $env:SOFLIA_SIGNTOOL_PATH
    if ($tool.PSIsContainer -or ($tool.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'SignTool inválido.' }
    return $tool.FullName
  }
  $base = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  $versions = Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -match '^\d+(\.\d+)+$' } | Sort-Object { [version]$_.Name } -Descending
  foreach ($version in $versions) {
    $candidate = Join-Path $version.FullName 'x64\signtool.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  throw 'Falta SignTool x64 del Windows SDK.'
}

function Get-RegularFiles([string]$Root) {
  $item = Get-Item -LiteralPath $Root -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'No se permiten enlaces en los artefactos de firma.' }
  if (!$item.PSIsContainer) { return ,$item }
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($item.FullName)
  while ($pending.Count -gt 0) {
    foreach ($child in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
      if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'No se permiten enlaces en el paquete.' }
      if ($child.PSIsContainer) { $pending.Push($child.FullName) } else { $child }
    }
  }
}

function Test-PortableExecutable($File) {
  $stream = [IO.File]::OpenRead($File.FullName)
  try { return $stream.Length -ge 2 -and $stream.ReadByte() -eq 77 -and $stream.ReadByte() -eq 90 }
  finally { $stream.Dispose() }
}

function Assert-Signature([string]$File, [bool]$Own) {
  $signature = Get-AuthenticodeSignature -LiteralPath $File
  if ($signature.Status -ne 'Valid' -or !$signature.SignerCertificate) { throw "Firma Authenticode inválida: $([IO.Path]::GetFileName($File))." }
  $publisher = $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  if ($Own -and ($publisher -cne $env:SOFLIA_WINDOWS_PUBLISHER -or !$signature.TimeStamperCertificate)) { throw 'El artefacto propio no tiene el editor esperado y sello de tiempo.' }
  return @{ publisher = $publisher; subject = $signature.SignerCertificate.Subject }
}

$signing = $Action -eq 'Check' -or $Action.StartsWith('Sign')
$metadata = $null
try {
  if ($signing) {
    if (!$env:SOFLIA_WINDOWS_PUBLISHER) { throw 'Falta SOFLIA_WINDOWS_PUBLISHER.' }
    $tool = Get-SignTool
    $arguments = @('sign', '/fd', 'SHA256', '/td', 'SHA256', '/tr', 'http://timestamp.acs.microsoft.com')
    if ($env:SOFLIA_SIGNING_PROVIDER -eq 'azure') {
      foreach ($key in @('SOFLIA_SIGNING_ENDPOINT','SOFLIA_SIGNING_ACCOUNT','SOFLIA_SIGNING_PROFILE','SOFLIA_SIGNING_DLIB_PATH','AZURE_TENANT_ID','AZURE_CLIENT_ID','AZURE_CLIENT_SECRET')) {
        if (![Environment]::GetEnvironmentVariable($key)) { throw "Falta $key." }
      }
      if (!(Test-Path -LiteralPath $env:SOFLIA_SIGNING_DLIB_PATH -PathType Leaf)) { throw 'Falta el dlib de Artifact Signing.' }
      $metadata = Join-Path ([IO.Path]::GetTempPath()) (('soflia-signing-' + [guid]::NewGuid().ToString()) + '.json')
      @{
        Endpoint=$env:SOFLIA_SIGNING_ENDPOINT; CodeSigningAccountName=$env:SOFLIA_SIGNING_ACCOUNT;
        CertificateProfileName=$env:SOFLIA_SIGNING_PROFILE;
        ExcludeCredentials=@('ManagedIdentityCredential','WorkloadIdentityCredential','SharedTokenCacheCredential','VisualStudioCredential','VisualStudioCodeCredential','AzureCliCredential','AzurePowerShellCredential','AzureDeveloperCliCredential','InteractiveBrowserCredential')
      } | ConvertTo-Json | Set-Content -LiteralPath $metadata -Encoding UTF8
      $arguments += @('/dlib', $env:SOFLIA_SIGNING_DLIB_PATH, '/dmdf', $metadata)
    } elseif ($env:SOFLIA_SIGNING_PROVIDER -eq 'certificate-store') {
      if ($env:SOFLIA_SIGNING_CERTIFICATE_SHA1 -notmatch '^[a-fA-F0-9]{40}$') { throw 'Thumbprint de certificado inválido.' }
      $arguments += @('/s', 'My', '/sha1', $env:SOFLIA_SIGNING_CERTIFICATE_SHA1)
    } else { throw 'Proveedor de firma no configurado.' }
  }
  if ($Action -eq 'Check') { @{ configured=$true } | ConvertTo-Json -Compress; exit 0 }
  if (!$Target -or ![IO.Path]::IsPathRooted($Target)) { throw 'El destino de firma debe ser absoluto.' }
  $files = @(Get-RegularFiles $Target | Where-Object { Test-PortableExecutable $_ })
  if ($files.Count -eq 0) { throw 'No hay binarios PE para verificar.' }
  $last = $null
  foreach ($file in $files) {
    if ($signing) {
      $before = Get-AuthenticodeSignature -LiteralPath $file.FullName
      if ($before.Status -ne 'Valid') {
        & $tool @arguments $file.FullName *> $null
        if ($LASTEXITCODE -ne 0) { throw "No se pudo firmar $($file.Name). Revisa identidad, permisos y servicio de firma." }
      }
    }
    $last = Assert-Signature $file.FullName $RequirePublisher.IsPresent
  }
  @{ verified=$files.Count; publisher=$last.publisher; subject=$last.subject } | ConvertTo-Json -Compress
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  if ($metadata -and (Test-Path -LiteralPath $metadata)) { Remove-Item -LiteralPath $metadata -Force }
}
