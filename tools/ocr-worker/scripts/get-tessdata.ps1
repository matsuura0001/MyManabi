<#
.SYNOPSIS
  Download Tesseract Japanese trained data for the MyManabi OCR worker.

.DESCRIPTION
  Fetches jpn / jpn_vert .traineddata from the tesseract-ocr GitHub repos into the
  tessdata folder the worker reads. These model files are NOT committed (large, and
  kept out of the public repo); each machine downloads its own copy.

  License: the trained data is Apache-2.0 (tesseract-ocr/tessdata_*).

.PARAMETER OutDir
  Target tessdata directory. Default: $env:MYMANABI_TESSDATA, else
  <DATA_DIR>/tessdata where DATA_DIR = $env:MYMANABI_DATA_DIR or %APPDATA%/MyManabi.

.PARAMETER Quality
  'best' (slower, more accurate) or 'fast' (smaller, quicker). Default: best.

.PARAMETER Languages
  Language codes to download. Default: jpn, jpn_vert.

.PARAMETER Force
  Re-download even if the file already exists.

.EXAMPLE
  pwsh tools/ocr-worker/scripts/get-tessdata.ps1
  pwsh tools/ocr-worker/scripts/get-tessdata.ps1 -Quality fast -OutDir .\tools\ocr-worker\tessdata
#>
[CmdletBinding()]
param(
    [string]$OutDir,
    [ValidateSet('best', 'fast')][string]$Quality = 'best',
    [string[]]$Languages = @('jpn', 'jpn_vert'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not $OutDir) {
    if ($env:MYMANABI_TESSDATA) {
        $OutDir = $env:MYMANABI_TESSDATA
    }
    else {
        $dataDir = if ($env:MYMANABI_DATA_DIR) { $env:MYMANABI_DATA_DIR } else { Join-Path $env:APPDATA 'MyManabi' }
        $OutDir = Join-Path $dataDir 'tessdata'
    }
}

$repo = if ($Quality -eq 'fast') { 'tessdata_fast' } else { 'tessdata_best' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Host "tessdata dir : $OutDir"
Write-Host "source repo  : tesseract-ocr/$repo"

foreach ($lang in $Languages) {
    $target = Join-Path $OutDir "$lang.traineddata"
    if ((Test-Path $target) -and -not $Force) {
        Write-Host "skip  $lang (exists; use -Force to overwrite)"
        continue
    }
    $url = "https://github.com/tesseract-ocr/$repo/raw/main/$lang.traineddata"
    Write-Host "fetch $lang <- $url"
    Invoke-WebRequest -Uri $url -OutFile $target
    $sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 1)
    Write-Host "saved $lang ($sizeMb MB)"
}

Write-Host "done. Point the worker at this folder with --tessdata `"$OutDir`" or set MYMANABI_TESSDATA."
