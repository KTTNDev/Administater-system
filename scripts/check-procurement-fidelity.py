"""Compare actual Word-rendered pages and preserve-only OOXML components."""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image,ImageChops,ImageFilter
from pypdf import PdfReader
import json,hashlib,re

root=Path(__file__).resolve().parent.parent/'output/procurement-lab/template-d07'
qa=json.loads((root/'qa.json').read_text(encoding='utf8'))
reference=(root/'reference.docx').read_bytes()
source=Path('C:/Users/PR-StartUp/Desktop/ตัวอย่างไฟล์งาน/7.รายงานพิจารณาผล.docx').read_bytes()
assert source==reference
original=Image.open(root/'reference-1.png').convert('RGB')
baseline=root/'generated'/qa['unchanged']['id']
black_policy=qa['unchanged'].get('outputVersion')=='D07-black-v1'
if black_policy:
    with ZipFile(root/'reference.docx') as a,ZipFile(baseline.with_suffix('.docx')) as b:
        assert b.read('word/document.xml')==a.read('word/document.xml').replace(b'w:val="FF0000"',b'w:val="000000"')
else:assert baseline.with_suffix('.docx').read_bytes()==reference
assert len(PdfReader(baseline.with_suffix('.pdf')).pages)==1
same=Image.open(str(baseline)+'-1.png').convert('RGB')
diff=ImageChops.difference(original,same)
if black_policy:
    mask=Image.new('L',original.size)
    mask.putdata([255 if r>120 and r>g+45 and r>b+45 else 0 for r,g,b in original.get_flattened_data()])
    allowed=mask.filter(ImageFilter.MaxFilter(7))
    assert ImageChops.multiply(diff,ImageChops.invert(allowed).convert('RGB')).getbbox() is None,'Layout changed outside approved red-to-black text'
else:assert diff.getbbox() is None,'Baseline pages moved'
edited=root/'generated'/qa['edited']['id']
assert len(PdfReader(edited.with_suffix('.pdf')).pages)==1
changed=Image.open(str(edited)+'-1.png').convert('RGB')
assert ImageChops.difference(original.crop((125,35,235,130)),changed.crop((125,35,235,130))).getbbox() is None,'Garuda moved'
with ZipFile(root/'reference.docx') as a,ZipFile(edited.with_suffix('.docx')) as b:
    assert set(a.namelist())==set(b.namelist())
    preserved=[]
    for name in a.namelist():
        if name!='word/document.xml':
            assert a.read(name)==b.read(name),name
            preserved.append(name)
    mask=lambda x:re.sub(rb'(<w:t\b[^>]*>).*?(</w:t>)',rb'\1\2',x,flags=re.S)
    reference_xml=a.read('word/document.xml')
    if black_policy:reference_xml=reference_xml.replace(b'w:val="FF0000"',b'w:val="000000"')
    assert mask(reference_xml)==mask(b.read('word/document.xml')),'Unexpected non-text XML change'
report={'reference_sha256':hashlib.sha256(source).hexdigest(),'baseline_byte_identical':not black_policy,'approved_red_to_black':black_policy,'unexpected_layout_differences':0,'dpi':120,'baseline_pages':1,'edited_pages':1,'edited_fields':qa['edited']['changed'],'preserved_parts':preserved,'non_text_xml_unchanged_except_approved_changes':True,'garuda_pixels_unchanged':True,'original_desktop_file_unchanged':True}
(root/'fidelity-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
