$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:3000'
function Test-Sarabun {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        if ($response.Content -notmatch 'DOCUMENT WORKSPACE') { throw 'Port 3000 belongs to another application.' }
        return $true
    } catch [System.Net.WebException] { return $false }
}
try {
    if (-not (Test-Sarabun)) {
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        if (-not (Test-Path -LiteralPath (Join-Path $workspace 'node_modules'))) { throw 'Install dependencies with npm ci first.' }
        if (-not (Test-Path -LiteralPath (Join-Path $workspace '.env.local'))) { throw 'Create .env.local from .env.example first.' }
        $logs = Join-Path $workspace 'output\logs'
        New-Item -ItemType Directory -Path $logs -Force | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $script = Join-Path $PSScriptRoot 'run-next.mjs'
        $server = Start-Process -FilePath $node -ArgumentList @(('"' + $script + '"'), 'dev') -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "$stamp-out.log") -RedirectStandardError (Join-Path $logs "$stamp-error.log") -PassThru
        $ready = $false
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep -Seconds 1
            $server.Refresh()
            if ($server.HasExited) { throw "Server stopped. See $logs" }
            if (Test-Sarabun) { $ready = $true; break }
        }
        if (-not $ready) { throw "Startup timed out. See $logs" }
    }
    $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($chrome) { Start-Process -FilePath $chrome -ArgumentList $url } else { Start-Process $url }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
