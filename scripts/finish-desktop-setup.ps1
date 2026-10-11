$ErrorActionPreference = 'Stop'
$targetPath = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourcePath = [IO.Path]::GetFullPath('D:\sarabun')
$backupPath = [IO.Path]::GetFullPath('D:\sarabun-before-desktop-20261007')
try {
    if ($targetPath -ne 'C:\Users\rawai\source\sarabun' -or $sourcePath -ne 'D:\sarabun' -or $backupPath -ne 'D:\sarabun-before-desktop-20261007') { throw 'Unexpected installation paths. Nothing was changed.' }
    if (-not (Test-Path -LiteralPath (Join-Path $targetPath '.desktop\current.json'))) { throw 'Verified desktop build is missing.' }
    $source = Get-Item -LiteralPath $sourcePath
    if ($source.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        if ($source.Target -contains $targetPath) { Write-Host 'D:\sarabun already points to the current project.'; exit 0 }
        throw 'D:\sarabun is a link to another location. Nothing was changed.'
    }
    if (Test-Path -LiteralPath $backupPath) { throw 'Backup folder already exists. Nothing was overwritten.' }
    foreach ($folder in @($sourcePath, $targetPath)) {
        $package = Get-Content -LiteralPath (Join-Path $folder 'package.json') -Raw | ConvertFrom-Json
        if ($package.name -ne 'sarabun-workspace') { throw 'Unexpected project identity. Nothing was changed.' }
    }
    Move-Item -LiteralPath $sourcePath -Destination $backupPath
    try { New-Item -ItemType Junction -Path $sourcePath -Target $targetPath | Out-Null }
    catch { Move-Item -LiteralPath $backupPath -Destination $sourcePath; throw }
    Write-Host 'Setup complete. D:\sarabun and the desktop shortcut now use the same project.'
    Write-Host 'Original project retained at D:\sarabun-before-desktop-20261007.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'If Windows says the folder is in use, close terminals/editors/Codex using D:\sarabun and run this file again.'
    Write-Host 'You can already use the Sarabun desktop shortcut independently.'
    exit 1
}
