$ErrorActionPreference = 'Stop'
$qaRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../output/procurement-stage-a'))
$word = $null
$doc = $null
$results = @()
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  foreach ($scenario in @('short','long','longer','columns')) {
    $inputPath = Join-Path $qaRoot "D07-$scenario.docx"
    if (-not (Test-Path -LiteralPath $inputPath)) { continue }
    $copyPath = Join-Path $qaRoot "word-qa-$scenario.docx"
    Copy-Item -LiteralPath $inputPath -Destination $copyPath -Force
    $doc = $word.Documents.Open($copyPath, $false, $false, $false)
    $count = $doc.ContentControls.Count
    if ($count -lt 35) { throw "Word lost content controls: $count" }
    if ($scenario -eq 'long') {
      $doc.SelectContentControlsByTag('sarabun:vendorName').Item(1).Range.Text = 'ร้านแก้ไขจาก Microsoft Word'
      $doc.SelectContentControlsByTag('sarabun:number').Item(1).Range.Text = 'ทด 0001/009'
      $doc.SelectContentControlsByTag('sarabun:date').Item(1).Range.Text = '16 พฤศจิกายน 2569'
    }
    $doc.Fields.Update() | Out-Null
    foreach ($section in $doc.Sections) { foreach ($footer in $section.Footers) { $footer.Range.Fields.Update() | Out-Null } }
    $doc.Repaginate()
    $pages = $doc.ComputeStatistics(2)
    $doc.ExportAsFixedFormat((Join-Path $qaRoot "word-qa-$scenario.pdf"), 17)
    $doc.Save()
    $results += [PSCustomObject]@{ scenario = $scenario; pages = $pages; controls = $count; bookmarks = $doc.Bookmarks.Count }
    $doc.Close(0)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)
    $doc = $null
  }
  $results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $qaRoot 'native-word-validation.json') -Encoding utf8
  $results | ConvertTo-Json
}
finally {
  if ($null -ne $doc) { $doc.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) }
  if ($null -ne $word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
}
