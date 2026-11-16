"""Private source copies stay in output; commit only code/hash definitions."""
from pathlib import Path
import hashlib,json
from docx import Document
from docx.shared import Mm,Pt
root=Path(__file__).resolve().parent.parent
folder=root/'output/procurement-suite/templates'
target=folder/'D10.docx'
if not target.exists():
 d=Document();s=d.sections[0];s.page_width=Mm(210);s.page_height=Mm(297);s.left_margin=Mm(30);s.right_margin=Mm(20);s.top_margin=Mm(25);s.bottom_margin=Mm(20)
 style=d.styles['Normal'];style.font.name='TH Sarabun New';style.font.size=Pt(16)
 for text in ['ข้อมูลสาระสำคัญจาก e-GP','แบบสรุปที่ผู้ใช้ร่างจากข้อมูล e-GP ไม่ใช่เอกสารที่ e-GP ออกให้','เลขโครงการ {{egpNumber}}','หน่วยงาน {{organization}}','เรื่อง {{action}}{{item}}','ผู้ขาย / ผู้รับจ้าง {{vendor}}','เลขผู้เสียภาษี {{vendorTaxId}}','วงเงิน {{agreed}} บาท ({{amountWords}})','เลขใบสั่ง / สัญญา {{orderNumber}} ลงวันที่ {{orderDate}}','กำหนดส่งมอบ {{contractDue}}','ภาพหน้าจอและไฟล์ต้นทางเก็บเป็นหลักฐานแนบในแฟ้มงาน']:
  d.add_paragraph(text)
 d.save(target)
entries={p.stem:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.glob('D*.docx'))}
assert len(entries)==14
extra={key:{'sha256':value,'outputVersion':key+('-correspondence-v2' if key in ['D02','D03','D05','D12','D13','D14'] else '-continuation-v1'),'slots':[]} for key,value in entries.items() if key not in ['D01','D07']}
(root/'src/lib/procurement-suite-definitions.ts').write_text("// Hashes of retained private sources; D06 was converted read-only by Word; D10 is a labelled summary form.\nexport const extraDocumentTemplates="+json.dumps(extra,ensure_ascii=False,indent=1)+" as const;\n",encoding='utf-8')
(folder.parent/'artifact.md').write_text('# Procurement source contract\n\nRetain all original package parts except document.xml and the continuation footer. Clone source item paragraphs/rows for repeated bill lines. Preserve Garuda, run and paragraph properties, anchored signatures and Choice/Fallback counterparts. D06 is the Word-converted legacy original. D10 has no supplied drafting source and is explicitly a new summary, never an e-GP-issued document. References and hashes:\n\n'+json.dumps(entries,indent=2)+'\n\nReference PDFs are adjacent to DOCX sources. Use native Word for authoritative rendering on this Windows host; the packaged LibreOffice renderer is unavailable here. Review all pages and changed source slots.\n',encoding='utf-8')
print(json.dumps({'templates':len(entries),'definitions':'src/lib/procurement-suite-definitions.ts'}))
