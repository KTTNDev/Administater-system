# แผนที่อ่านโค้ด — scripts/setup-production.ps1
# หน้าที่: รับรหัสผ่านแบบไม่แสดงบนจอแล้วส่งให้ configure-production.mjs โดยไม่ใส่รหัสลง command line
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
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
function Read-PlainPassword([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}
try {
    Write-Host 'Sarabun production setup. Password input is hidden.'
    Write-Host 'This changes the shared operator password. Restart the server afterwards.'
    $password = Read-PlainPassword 'New password (12-128 characters)'
    $confirmation = Read-PlainPassword 'Confirm password'
    if ($password -cne $confirmation) { throw 'Passwords do not match. Nothing was saved.' }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = (Get-Command node.exe).Source
    $info.Arguments = '"' + (Join-Path $PSScriptRoot 'configure-production.mjs') + '"'
    $info.WorkingDirectory = $workspace
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $process = [System.Diagnostics.Process]::Start($info)
    $process.StandardInput.WriteLine((@{password=$password} | ConvertTo-Json -Compress))
    $process.StandardInput.Close()
    $password = $null; $confirmation = $null
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'Setup failed. See the message above.' }
    $process.Dispose()
    Write-Host 'Next: npm run build, close the development server, then Open-Sarabun-Production.cmd.'
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
