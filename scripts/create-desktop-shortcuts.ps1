param(
  [string]$DesktopPath,
  [string]$ShortcutLabel = 'Sarabun - New PC'
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$openCommand = Join-Path $projectRoot 'Open-Sarabun.cmd'
$stopCommand = Join-Path $projectRoot 'Stop-Sarabun.cmd'
if (-not (Test-Path -LiteralPath $openCommand) -or -not (Test-Path -LiteralPath $stopCommand)) {
  throw 'Open-Sarabun.cmd or Stop-Sarabun.cmd is missing.'
}
if (-not $DesktopPath) {
  $DesktopPath = [Environment]::GetFolderPath('Desktop')
  if (-not $DesktopPath) {
    $DesktopPath = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders').Desktop
    $DesktopPath = [Environment]::ExpandEnvironmentVariables($DesktopPath)
  }
}
if (-not $DesktopPath) { throw 'Cannot locate the current user Desktop.' }
New-Item -ItemType Directory -Path $DesktopPath -Force | Out-Null
$desktop = (Resolve-Path -LiteralPath $DesktopPath).Path
$wsh = New-Object -ComObject WScript.Shell
try {
  foreach ($item in @(@{ Name = $ShortcutLabel; Target = $openCommand; Description = 'Open Sarabun from the local installation' }, @{ Name = "$ShortcutLabel - Stop"; Target = $stopCommand; Description = 'Stop this Sarabun installation' })) {
    $linkPath = Join-Path $desktop ($item.Name + '.lnk')
    if (Test-Path -LiteralPath $linkPath) {
      $existing = $wsh.CreateShortcut($linkPath)
      if (-not [string]::Equals($existing.TargetPath, $item.Target, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Shortcut already belongs to another installation: $linkPath"
      }
    }
    $link = $wsh.CreateShortcut($linkPath)
    $link.TargetPath = $item.Target
    $link.WorkingDirectory = $projectRoot
    $link.Description = $item.Description
    $link.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
    $link.Save()
    $check = $wsh.CreateShortcut($linkPath)
    if (-not [string]::Equals($check.TargetPath, $item.Target, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Shortcut could not be verified: $linkPath"
    }
    Write-Output "Created: $linkPath"
  }
} finally {
  if ($wsh) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wsh) }
}
