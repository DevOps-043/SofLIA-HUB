import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execAsync } from './exec';
import { readRawSearchResults, toSearchResult, type FileSearchResult } from './search-utils';

export async function searchFilesWithWindowsIndex(
  home: string,
  normalizedQuery: string,
): Promise<FileSearchResult[]> {
  const tmpDir = app.getPath('temp');
  const scriptPath = path.join(tmpDir, 'soflia_index_search.ps1');
  const outputPath = path.join(tmpDir, 'soflia_index_results.json');
  const homeUrl = home.replace(/\\/g, '/');
  const likeClause = `System.FileName LIKE '%${normalizedQuery}%'`;
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$results = @()
try {
  $conn = New-Object -ComObject ADODB.Connection
  $conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
  $sql = "SELECT System.ItemPathDisplay, System.Size FROM SystemIndex WHERE ${likeClause} AND scope='file:${homeUrl}'"
  $rs = $conn.Execute($sql)
  while (-not $rs.EOF) {
    $fp = $rs.Fields.Item("System.ItemPathDisplay").Value
    $sz = $rs.Fields.Item("System.Size").Value
    if ($fp) {
      $results += [PSCustomObject]@{ FullName = $fp; Length = if ($sz) { $sz } else { 0 } }
      if ($results.Count -ge 20) { break }
    }
    $rs.MoveNext()
  }
  $rs.Close()
  $conn.Close()
} catch { }
$results | ConvertTo-Json -Compress | Out-File -FilePath "${outputPath}" -Encoding utf8
`;

  try {
    await fs.writeFile(scriptPath, psScript, 'utf-8');
    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    return (await readRawSearchResults(outputPath))
      .filter((item) => Boolean(item.FullName))
      .map((item) => toSearchResult(item.FullName!, item.Length || 0));
  } finally {
    fs.unlink(scriptPath).catch(() => {});
    fs.unlink(outputPath).catch(() => {});
  }
}
