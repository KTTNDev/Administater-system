param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputPath,[string]$RenderRoot='')
$ErrorActionPreference='Stop'
$allowedRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../output/procurement-lab'))+[IO.Path]::DirectorySeparatorChar
if ($RenderRoot) {
  $jobRoot=[IO.Path]::GetFullPath($RenderRoot)
  $marker=Join-Path $jobRoot '.sarabun-render-job'
  if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -ne 'SARABUN_PROCUREMENT_RENDER_V1') {throw 'Invalid render job marker'}
  $allowedRoot=$jobRoot+[IO.Path]::DirectorySeparatorChar
}
$inputFile=[IO.Path]::GetFullPath($InputPath)
$outputFile=[IO.Path]::GetFullPath($OutputPath)
if (-not $inputFile.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase) -or -not $outputFile.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase)) {throw 'Render paths must stay in the allowed job folder'}
if ([IO.Path]::GetExtension($inputFile) -ne '.docx' -or [IO.Path]::GetExtension($outputFile) -ne '.pdf') {throw 'Expected DOCX input and PDF output'}
$word=$null; $document=$null
$renderLog=$outputFile+'.render.log'
try {
  'Starting Word' | Set-Content -LiteralPath $renderLog
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false; $word.DisplayAlerts=0; $word.AutomationSecurity=3
  'Opening readonly DOCX' | Add-Content -LiteralPath $renderLog
  $document=$word.Documents.Open($inputFile,$false,$true,$false)
  $word.ActiveWindow.View.Type=3
  foreach ($section in $document.Sections) {foreach ($header in $section.Headers) {if ($header.Exists) {[void]$header.Range.Fields.Update()}};foreach ($footer in $section.Footers) {if ($footer.Exists) {[void]$footer.Range.Fields.Update()}}}
  'Paginating' | Add-Content -LiteralPath $renderLog
  $document.Repaginate()
  'Exporting PDF' | Add-Content -LiteralPath $renderLog
  $document.ExportAsFixedFormat($outputFile,17)
  $document.Repaginate()
  $pages=$document.ComputeStatistics(2)
  $pageTexts=@()
  for ($pageIndex=1; $pageIndex -le $pages; $pageIndex++) {
    $pageStart=$document.GoTo(1,1,$pageIndex).Start
    $pageEnd=if ($pageIndex -lt $pages) {$document.GoTo(1,1,($pageIndex+1)).Start} else {$document.Content.End}
    $pageRange=$document.Range($pageStart,$pageEnd)
    $pageText=$pageRange.Text
    # Word exposes Wingdings checkboxes as ordinary parentheses in Range.Text.
    # Cues use the real words, while legitimate parentheses around names remain.
    if ($pageText -match '^[\s\x00-\x1f]*\(') {
      $snippet=''
      for ($characterIndex=1; $characterIndex -le [Math]::Min(120,$pageRange.Characters.Count); $characterIndex++) {
        $character=$pageRange.Characters.Item($characterIndex)
        $symbol=$character.Font.Name -match '^(Wingdings|Webdings|Symbol)'
        if (-not $symbol -and $character.Text -match '^[()]$') {$symbol=$character.WordOpenXML -match '<w:sym\b'}
        if (-not $symbol) {$snippet+=$character.Text}
      }
      $pageText=$snippet
    }
    if (-not ($pageText -replace '[\s\x00-\x1f]','')) {
      foreach ($shape in $document.Shapes) {try {if ($shape.Anchor.Information(3) -eq $pageIndex -and $shape.TextFrame.HasText) {$pageText+=$shape.TextFrame.TextRange.Text+' '}} catch {}}
    }
    $pageTexts+=([string]$pageText).Substring(0,[Math]::Min(1000,([string]$pageText).Length))
  }
  $document.ExportAsFixedFormat($outputFile,17)
  $mainText=[string]$document.Content.Text
  @{pages=$pages;pageTexts=$pageTexts;mainText=$mainText.Substring(0,[Math]::Min(1000,$mainText.Length))} | ConvertTo-Json -Depth 4 -Compress | Set-Content -LiteralPath ($outputFile+'.layout.json') -Encoding UTF8
  'Export complete' | Add-Content -LiteralPath $renderLog
  @{pages=$pages;renderer='Microsoft Word';readonly=$true} | ConvertTo-Json -Compress
} finally {
  if ($null -ne $document) {$document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)}
  if ($null -ne $word) {$word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)}
}
