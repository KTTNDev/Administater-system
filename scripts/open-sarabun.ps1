# แผนที่อ่านโค้ด — scripts/open-sarabun.ps1
# หน้าที่: ตัวเปิดระบบ Windows รุ่นเดิม อ่านไฟล์นี้เพื่อเข้าใจขั้นตอน launch ที่เคยใช้; ตัวเปิดปัจจุบันดู open-local.mjs
#
# ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
# 1. ./open-local.mjs
# 2. ./run-next.mjs
# 3. ../next.config.mjs
# 4. ../src/app/api/health/route.ts
# 5. ../src/app/page.tsx
# ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
#
# แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
# การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
param([ValidateSet('dev','start')][string]$Mode = 'dev')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:3000'
function Test-Sarabun {
    try {
        $response = Invoke-RestMethod -Uri ($url + '/api/health') -TimeoutSec 2
        if ($response.application -ne 'sarabun') { throw 'Port 3000 belongs to another application or an older server. Close it first.' }
        if ($response.mode -ne $Mode) { throw 'The server on port 3000 is in a different mode. Close it before switching modes.' }
        return $true
    } catch [System.Net.WebException] { return $false }
}
try {
    if (-not (Test-Sarabun)) {
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        if (-not (Test-Path -LiteralPath (Join-Path $workspace 'node_modules'))) { throw 'Install dependencies with npm ci first.' }
        if (-not (Test-Path -LiteralPath (Join-Path $workspace '.env.local'))) { throw 'Create .env.local from .env.example first.' }
        if ($Mode -eq 'start') {
            Push-Location $workspace
            try {
                & $node (Join-Path $PSScriptRoot 'check-production.mjs')
                if ($LASTEXITCODE -ne 0) { throw 'Production checks failed. See the message above.' }
            } finally { Pop-Location }
        }
        $logs = Join-Path $workspace 'output\logs'
        New-Item -ItemType Directory -Path $logs -Force | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $script = Join-Path $PSScriptRoot 'run-next.mjs'
        $server = Start-Process -FilePath $node -ArgumentList @(('"' + $script + '"'), $Mode) -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "$stamp-out.log") -RedirectStandardError (Join-Path $logs "$stamp-error.log") -PassThru
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
