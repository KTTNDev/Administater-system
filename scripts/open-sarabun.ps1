param([ValidateSet('dev','start')][string]$Mode = 'start')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
try {
    if ($Mode -eq 'dev') {
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        & $node (Join-Path $PSScriptRoot 'run-next.mjs') dev
    } else {
        $node = Join-Path $workspace '.desktop\runtime\node.exe'
        if (-not (Test-Path -LiteralPath $node)) { throw 'Desktop package missing. Run Build-Sarabun.cmd first.' }
        & $node (Join-Path $PSScriptRoot 'desktop.mjs') start
    }
    exit $LASTEXITCODE
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
