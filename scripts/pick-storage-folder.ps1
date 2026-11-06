Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$picker = New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description = 'เลือกโฟลเดอร์ว่างสำหรับเก็บฐานข้อมูลและแฟ้มงานสารบรรณ'
$picker.ShowNewFolderButton = $true
try {
    $answer = $picker.ShowDialog()
    if ($answer -eq [System.Windows.Forms.DialogResult]::OK) {
        ConvertTo-Json -InputObject $picker.SelectedPath -Compress
    } else {
        'null'
    }
} finally {
    $picker.Dispose()
}
