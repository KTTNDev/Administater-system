param([string]$Source='C:\Users\PR-StartUp\Desktop\ตัวอย่างไฟล์งาน')
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../output/procurement-suite'))
New-Item -ItemType Directory -Path (Join-Path $root 'templates') -Force | Out-Null
$map=@{D01='1.บันทึกข้อความ ขออนุมัติจัดซื้อจัดจ้าง 1439.docx';D02='1.มอบหมาย 1446.docx';D03='3.กำหนดคุณลักษณะ 1447.docx';D04='4.TOR.docx';D05='5.รายงานขอจ้าง.docx';D06='6.คำสั่ง รอออกเลขคำสั่ง.doc';D07='7.รายงานพิจารณาผล.docx';D08='8.ประกาศผู้ชนะ  ยังไม่แก้.docx';D09='9.ใบสั่งจ้าง.docx';D11='11.ใบตรวจรับการจัดซื้อ(ปริ้น2ชุด).docx';D12='12.รายงานผลการตรวจรับพัสดุ.docx';D13='13.รายงานผลการพิจารณารายละเอียดวิธีการ.docx';D14='14.บันทึกข้อความอนุมัติเบิกเงิน.docx'}
$word=$null;$doc=$null
try {
 $word=New-Object -ComObject Word.Application;$word.Visible=$false;$word.DisplayAlerts=0;$word.AutomationSecurity=3
 foreach($code in ($map.Keys | Sort-Object)) {
  $src=Join-Path $Source $map[$code];$dest=Join-Path $root ('templates/'+$code+'.docx');$pdf=Join-Path $root ('templates/'+$code+'-reference.pdf')
  if(-not(Test-Path -LiteralPath $dest)) {
   if($code -eq 'D06'){$doc=$word.Documents.Open($src,$false,$true,$false);$doc.SaveAs2($dest,16);$doc.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc);$doc=$null}
   else {Copy-Item -LiteralPath $src -Destination $dest}
  }
  if(-not(Test-Path -LiteralPath $pdf)){$doc=$word.Documents.Open($dest,$false,$true,$false);$doc.Repaginate();$doc.ExportAsFixedFormat($pdf,17);$doc.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc);$doc=$null}
  Write-Output ($code+' source retained and rendered')
 }
} finally {if($doc){$doc.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)};if($word){$word.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)}}
