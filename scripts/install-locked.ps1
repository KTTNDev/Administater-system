# Alternative installation for Windows machines with very slow per-file metadata writes.
# Uses package-lock.json integrity hashes and only installs the current OS/architecture.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$modulesRoot = [IO.Path]::GetFullPath((Join-Path $workspace 'node_modules'))
$cache = Join-Path $workspace '.tools/package-cache'
[IO.Directory]::CreateDirectory($cache) | Out-Null
$lock = Get-Content -Raw (Join-Path $workspace 'package-lock.json') | ConvertFrom-Json -AsHashtable
$count = 0
$lock.packages.GetEnumerator() | ForEach-Object -Parallel {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    $workspace = $using:workspace; $modulesRoot = $using:modulesRoot; $cache = $using:cache; $item = $_
    if (-not $item.Key) { return }
    $pkg = $item.Value
    if ($pkg.os -and 'win32' -notin $pkg.os) { return }
    if ($pkg.cpu -and 'x64' -notin $pkg.cpu) { return }
    if (-not $pkg.resolved -or -not $pkg.integrity) { throw "Missing integrity: $($item.Key)" }
    if (-not $pkg.resolved.StartsWith('https://registry.npmjs.org/')) { throw "Unexpected registry: $($item.Key)" }
    $destination = [IO.Path]::GetFullPath((Join-Path $workspace $item.Key))
    if (-not $destination.StartsWith($modulesRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid module path' }
    $hash = $pkg.integrity.Split('-',2)
    if ($hash[0] -ne 'sha512') { throw "Unsupported integrity: $($item.Key)" }
    $cacheName = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($pkg.resolved)))
    $tarball = Join-Path $cache ($cacheName + '.tgz')
    $marker = Join-Path $cache ($cacheName + '.done')
    if ((Test-Path $marker) -and (Test-Path (Join-Path $destination 'package.json'))) { return }
    if (-not (Test-Path $tarball)) { Invoke-WebRequest -Uri $pkg.resolved -OutFile $tarball }
    $bytes = [IO.File]::ReadAllBytes($tarball)
    $actual = [Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData($bytes))
    if ($actual -ne $hash[1]) { throw "Integrity mismatch: $($item.Key)" }
    [IO.Directory]::CreateDirectory($destination) | Out-Null
    $source = [IO.MemoryStream]::new($bytes, $false)
    $gzip = [IO.Compression.GZipStream]::new($source,[IO.Compression.CompressionMode]::Decompress)
    $reader = [System.Formats.Tar.TarReader]::new($gzip)
    $dirs = [Collections.Generic.HashSet[string]]::new()
    try {
        while ($entry = $reader.GetNextEntry()) {
            $relative = $entry.Name -replace '^package/', ''
            if (-not $relative -or $relative -eq 'package') { continue }
            $target = [IO.Path]::GetFullPath((Join-Path $destination $relative))
            if (-not $target.StartsWith($destination + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe archive path' }
            if ($entry.EntryType -eq [System.Formats.Tar.TarEntryType]::Directory) { continue }
            if ($entry.EntryType -notin @([System.Formats.Tar.TarEntryType]::RegularFile,[System.Formats.Tar.TarEntryType]::V7RegularFile)) { throw "Unsupported archive entry: $($entry.Name)" }
            $parent = [IO.Path]::GetDirectoryName($target)
            if ($dirs.Add($parent)) { [IO.Directory]::CreateDirectory($parent) | Out-Null }
            $memory = [IO.MemoryStream]::new()
            try { $entry.DataStream.CopyTo($memory); [IO.File]::WriteAllBytes($target,$memory.ToArray()) } finally { $memory.Dispose() }
        }
    } finally { $reader.Dispose(); $gzip.Dispose(); $source.Dispose() }
    [IO.File]::WriteAllText($marker,$item.Key)

    Write-Host "Installed $($item.Key) $($pkg.version)"
} -ThrottleLimit 12
$bin = Join-Path $modulesRoot '.bin'
[IO.Directory]::CreateDirectory($bin) | Out-Null
foreach ($command in @(@('next','next/dist/bin/next'),@('tsc','typescript/bin/tsc'),@('vitest','vitest/vitest.mjs'),@('playwright','@playwright/test/cli.js'))) {
    $entryPath = '..\' + $command[1].Replace('/','\')
    $body = '@echo off' + "`r`n" + 'node "%~dp0' + $entryPath + '" %*' + "`r`n"
    [IO.File]::WriteAllText((Join-Path $bin ($command[0]+'.cmd')),$body)
}
Write-Host "Completed locked packages. Run npm rebuild better-sqlite3 esbuild next."



