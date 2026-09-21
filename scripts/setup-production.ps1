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
