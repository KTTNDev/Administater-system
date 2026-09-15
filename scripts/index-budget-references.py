"""Rebuild the searchable index from the supplied PDFs; never edits originals."""
import json,re,hashlib
from pathlib import Path
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]
folder=root/'data/budget-references'
pages=[];items=[];manifest={}
for source in ['ict','ict-2569','equipment','classification']:
    file=folder/(source+'.pdf'); reader=PdfReader(file)
    manifest[source]={'pages':len(reader.pages),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    clean=[];offsets=[];offset=0
    for i,p in enumerate(reader.pages):
        text=p.extract_text() or ''
        pages.append({'source':source,'page':i+1,'text':text})
        body='\n'.join(line.strip() for line in text.splitlines() if line.strip() and not line.strip().isdigit() and not line.startswith('เกณฑ์ราคากลาง') and not line.startswith('ประกาศ ณ'))
        offsets.append((offset,i+1));clean.append(body);offset+=len(body)+1
    if not source.startswith('ict'):continue
    text='\n'.join(clean)
    starts=[m for m in re.finditer(r'(?m)^(\d{1,2})\.\s+((?:เครื่อง|อุปกรณ์|คอมพิวเตอร์|ค่าเช่า|ชุดโปรแกรม|จอแสดง|ตู้|สแกนเนอร์)[^\n]+)',text) if re.search(r'ราคา\s*[\d,]+\s*บาท',text[m.start():m.start()+450])]
    for j,m in enumerate(starts):
        code=int(m[1]);chunk=text[m.start():starts[j+1].start() if j+1<len(starts) else len(text)]
        price=re.search(r'ราคา\s*([\d,]+)\s*บาท',chunk)
        if not price or not re.match(r'(เครื่อง|อุปกรณ์|คอมพิวเตอร์|ค่าเช่า|ชุดโปรแกรม|จอแสดง|ตู้|สแกนเนอร์)',m[2]):continue
        title=re.sub(r'\s+',' ',chunk[len(m[1])+1:price.start()]).strip()
        page=next(p for off,p in reversed(offsets) if off<=m.start())
        spec=chunk[price.end():].strip()
        spec=re.sub(r'^[^\n]*\n','',spec) if not spec.startswith('คุณลักษณะ') else spec
        spec=spec.removeprefix('คุณลักษณะพื้นฐาน').strip() if 'คุณลักษณะพื้นฐาน' in chunk else ''
        # Retain paragraphs/bullets; unwrap PDF line wrapping inside bullets.
        spec=re.sub(r'(?<!\n)\n(?![-\n]|หมายเหตุ|\d+\.)',' ',spec).strip()
        hardware=not title.startswith(('ค่าเช่า','ชุดโปรแกรม'))
        items.append({'id':f'{source}-{code}','source':source,'page':page,'code':str(code),'title':title,'price':price[1].replace(',',''),'specification':spec,'type':'ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์' if hardware else '', 'classificationPage':52 if hardware else 0,'archived':source=='ict' and code<=11})
# Curated office entries, page numbers are physical PDF pages (printed page + 6).
for code,title,price,page,specpage in [('10.11','เครื่องพิมพ์บัตรพลาสติกแบบหน้าเดียว','41600',37,95),('10.12','เครื่องสแกนลายนิ้วมือ ชนิดบันทึกเวลาเข้าออกงาน','8000',37,95),('10.13','โต๊ะหมู่บูชา','9400',37,95),('10.14.1','ตู้เหล็ก แบบ 2 บาน','6600',37,96),('10.14.2','ตู้เหล็ก แบบ 4 ลิ้นชัก','7200',37,96),('10.15','ตู้ล็อกเกอร์ 18 ช่อง','9000',37,96),('10.6.3','เครื่องปรับอากาศ แบบติดผนัง ขนาด 12,000 บีทียู','16800',35,93),('10.6.4','เครื่องปรับอากาศ แบบติดผนัง ระบบ Inverter ขนาด 12,000 บีทียู','19500',35,93),('10.8.1','เครื่องดูดฝุ่น ขนาด 15 ลิตร','8600',36,94),('10.8.2','เครื่องดูดฝุ่น ขนาด 25 ลิตร','13700',36,94),('10.9','เครื่องขัดพื้น','21000',36,94)]:
    items.append({'id':'equipment-'+code,'source':'equipment','page':page,'code':code,'title':title,'price':price,'specification':'','specPage':specpage,'type':'ครุภัณฑ์สำนักงาน','classificationPage':42,'archived':False})
# Scanned circular: human-reviewed guide index, not a claim of full OCR.
guides={1:'หนังสือ มท 0808.2/ว 1095 28 พฤษภาคม 2564 รูปแบบและการจำแนกประเภทรายรับรายจ่าย',37:'วัสดุคอมพิวเตอร์ สายเคเบิล เมาส์ แป้นพิมพ์ วัสดุสิ้นเปลือง',42:'งบลงทุน ค่าครุภัณฑ์ ครุภัณฑ์สำนักงาน โต๊ะ เก้าอี้ ตู้เก็บเอกสาร เครื่องชุมสายโทรศัพท์ ตู้โทรศัพท์ โทรศัพท์พื้นฐาน เครื่องปรับอากาศ เครื่องทำลายเอกสาร',52:'ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์ คอมพิวเตอร์ จอภาพ เครื่องพิมพ์ เครื่องสำรองไฟฟ้า สแกนเนอร์ ระบบกล้องโทรทัศน์วงจรปิด',53:'ครุภัณฑ์สนาม ครุภัณฑ์อื่น ค่าบำรุงรักษาและปรับปรุงครุภัณฑ์'}
for p in pages:
    if p['source']=='classification':p['text']=guides.get(p['page'],'')
out={'manifest':manifest,'items':items,'pages':pages}
(root/'src/lib/budget-reference-index.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Indexed {len(items)} catalogue entries and {len(pages)} PDF pages')
