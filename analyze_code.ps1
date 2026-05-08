$extensions = @(".ts", ".tsx")
$excludeDirs = @("node_modules", "dist", "build", ".git", "out", "dist-electron", "release")

$files = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $exclude = $false
    foreach ($dir in $excludeDirs) {
        if ($_.FullName -match "\\$dir\\") {
            $exclude = $true
            break
        }
    }
    if (-not $exclude) {
        if ($extensions -contains $_.Extension) {
            return $true
        }
    }
    return $false
}

$totalFiles = 0
$totalLines = 0
$buckets = [ordered]@{
    "< 100" = 0
    "100 - 199" = 0
    "200 - 299" = 0
    "300 - 399" = 0
    "400 - 499" = 0
    "500 - 599" = 0
    "600 - 699" = 0
    "700 - 799" = 0
    "800 - 899" = 0
    "900 - 999" = 0
    ">= 1000" = 0
}

$archivosGrandes = @()

foreach ($file in $files) {
    $totalFiles++
    
    $lines = [System.IO.File]::ReadAllLines($file.FullName)
    $lineCount = 0
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line) -eq $false) {
            $lineCount++
        }
    }
    
    $totalLines += $lineCount

    if ($lineCount -lt 100) { $buckets["< 100"]++ }
    elseif ($lineCount -lt 200) { $buckets["100 - 199"]++ }
    elseif ($lineCount -lt 300) { $buckets["200 - 299"]++ }
    elseif ($lineCount -lt 400) { $buckets["300 - 399"]++ }
    elseif ($lineCount -lt 500) { $buckets["400 - 499"]++ }
    elseif ($lineCount -lt 600) { $buckets["500 - 599"]++ }
    elseif ($lineCount -lt 700) { $buckets["600 - 699"]++ }
    elseif ($lineCount -lt 800) { $buckets["700 - 799"]++ }
    elseif ($lineCount -lt 900) { $buckets["800 - 899"]++ }
    elseif ($lineCount -lt 1000) { $buckets["900 - 999"]++ }
    else { 
        $buckets[">= 1000"]++
    }

    if ($lineCount -ge 700) {
        # Guardar la ruta relativa del archivo y su cantidad de líneas
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        $archivosGrandes += [PSCustomObject]@{
            Ruta = $relativePath
            Lineas = $lineCount
        }
    }
}

Write-Host "=========================================="
Write-Host "Resumen del Proyecto"
Write-Host "=========================================="
Write-Host "Total de archivos analizados: $totalFiles"
Write-Host "Total de líneas de código (sin líneas en blanco/espacios): $totalLines"
Write-Host ""
Write-Host "Distribución de archivos por cantidad de líneas:"
Write-Host "Menos de 100: $($buckets['< 100']) archivos"
Write-Host "De 100 a 199: $($buckets['100 - 199']) archivos"
Write-Host "De 200 a 299: $($buckets['200 - 299']) archivos"
Write-Host "De 300 a 399: $($buckets['300 - 399']) archivos"
Write-Host "De 400 a 499: $($buckets['400 - 499']) archivos"
Write-Host "De 500 a 599: $($buckets['500 - 599']) archivos"
Write-Host "De 600 a 699: $($buckets['600 - 699']) archivos"
Write-Host "De 700 a 799: $($buckets['700 - 799']) archivos"
Write-Host "De 800 a 899: $($buckets['800 - 899']) archivos"
Write-Host "De 900 a 999: $($buckets['900 - 999']) archivos"
Write-Host "1000 o más:   $($buckets['>= 1000']) archivos"

if ($archivosGrandes.Count -gt 0) {
    Write-Host "=========================================="
    Write-Host "Archivos con 700 líneas o más:"
    Write-Host "=========================================="
    $archivosGrandes | Sort-Object Lineas -Descending | Format-Table -AutoSize
}
Write-Host "=========================================="
