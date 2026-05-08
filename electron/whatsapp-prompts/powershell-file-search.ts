import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execAsync } from './exec';
import { readRawSearchResults, toSearchResult, type FileSearchResult } from './search-utils';

export async function searchFilesWithPowerShell(
  home: string,
  normalizedQuery: string,
  searchWords: string[],
): Promise<FileSearchResult[]> {
  const tmpDir = app.getPath('temp');
  const scriptPath = path.join(tmpDir, 'soflia_search.ps1');
  const outputPath = path.join(tmpDir, 'soflia_search_results.json');
  const wordsArrayPS = searchWords.map((word) => `"${word}"`).join(', ');

  const psScript = `
$results = @()
$searchWords = @(${wordsArrayPS})
$searchFull = "${normalizedQuery}"
$items = Get-ChildItem -Path "${home}" -Recurse -Depth 8 -ErrorAction SilentlyContinue
foreach ($item in $items) {
  if (-not $item.PSIsContainer) {
    $normalized = $item.Name.Normalize([System.Text.NormalizationForm]::FormD)
    $normalized = [regex]::Replace($normalized, '[\\u0300-\\u036f]', '')
    $normalizedLower = $normalized.ToLower()
    $matchFull = $normalizedLower -like "*$searchFull*"
    $matchWords = $true
    if (-not $matchFull -and $searchWords.Count -gt 1) {
      foreach ($w in $searchWords) {
        if ($normalizedLower -notlike "*$w*") { $matchWords = $false; break }
      }
    } elseif (-not $matchFull) {
      $matchWords = $false
    }
    if ($matchFull -or $matchWords) {
      $results += [PSCustomObject]@{ FullName = $item.FullName; Length = $item.Length }
      if ($results.Count -ge 20) { break }
    }
  }
}
$results | ConvertTo-Json -Compress | Out-File -FilePath "${outputPath}" -Encoding utf8
`;

  try {
    await fs.writeFile(scriptPath, psScript, 'utf-8');
    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      timeout: 45000,
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
