param([string]$Folder = 'output/word-check', [string]$Filter = '*.docx')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Folder).Path
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$results = @()
try {
  foreach ($file in Get-ChildItem -LiteralPath $root -Filter $Filter) {
    $document = $null
    try {
      $document = $word.Documents.Open($file.FullName, $false, $true, $false)
      $document.Repaginate()
      $pdf = [IO.Path]::ChangeExtension($file.FullName, '.pdf')
      $document.ExportAsFixedFormat($pdf, 17)
      $results += [pscustomobject]@{file=$file.Name; pages=$document.ComputeStatistics(2); tables=$document.Tables.Count; characters=$document.Characters.Count}
      Write-Output ($results[-1] | ConvertTo-Json -Compress)
    } finally { if ($null -ne $document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) } }
  }
} finally { $word.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
$results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'word-render-results.json') -Encoding utf8
