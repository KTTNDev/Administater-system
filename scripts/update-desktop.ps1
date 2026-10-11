param([switch]$Rollback)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$root = Split-Path -Parent $PSScriptRoot
$node = Join-Path $root '.desktop\runtime\node.exe'
$script = Join-Path $PSScriptRoot 'update-desktop.mjs'
try {
  if ($Rollback) {
    $answer = [System.Windows.Forms.MessageBox]::Show('ย้อนกลับทั้งโปรแกรมและข้อมูลไปก่อนอัปเดตหรือไม่? งานที่เพิ่มหลังอัปเดตจะเก็บแยกไว้ในชุดสำรองก่อนย้อนกลับ กรุณาบันทึกและปิดหน้าต่างงานก่อนดำเนินการ', 'ย้อนรุ่นสารบรรณ', 'YesNo', 'Warning')
    if ($answer -ne 'Yes') { exit 0 }
    & $node $script rollback --confirm-restore
  } else {
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'เลือกโฟลเดอร์ชุดอัปเดตที่แตก ZIP แล้ว (มี update-manifest.json)'
    if ($picker.ShowDialog() -ne 'OK') { exit 0 }
    $answer = [System.Windows.Forms.MessageBox]::Show('บันทึกงานและปิดหน้าต่างงานแล้วหรือยัง? ระบบจะสำรองข้อมูลก่อนอัปเดต ใช้เฉพาะชุดอัปเดตจากผู้พัฒนาที่คุณเชื่อถือ', 'อัปเดตสารบรรณ', 'OKCancel', 'Information')
    if ($answer -ne 'OK') { exit 0 }
    & $node $script apply $picker.SelectedPath
  }
  if ($LASTEXITCODE -ne 0) { throw 'ดำเนินการไม่สำเร็จ อ่านรายละเอียดในหน้าต่างคำสั่ง ข้อมูลสำรองยังถูกเก็บไว้' }
  [System.Windows.Forms.MessageBox]::Show('เสร็จแล้ว เปิด Open-Sarabun.cmd เพื่อใช้งาน', 'สารบรรณ') | Out-Null
} catch {
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'สารบรรณ', 'OK', 'Error') | Out-Null
  exit 1
}
