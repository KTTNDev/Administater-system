"""Retain D07 unchanged and inventory all package parts and text locations."""
import hashlib,json,shutil
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as E

repo=Path(__file__).resolve().parent.parent
source=Path('C:/Users/PR-StartUp/Desktop/ตัวอย่างไฟล์งาน/7.รายงานพิจารณาผล.docx')
root=repo/'output/procurement-lab/template-d07'
root.mkdir(parents=True,exist_ok=True)
digest=lambda b:hashlib.sha256(b).hexdigest()
raw=source.read_bytes()
target=root/'reference.docx'
if target.exists() and target.read_bytes()!=raw: raise RuntimeError('Reference changed; do not replace an established baseline')
if not target.exists(): shutil.copyfile(source,target)
w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
parts=[]; paragraphs=[]
with ZipFile(source) as z:
    for info in z.infolist():
        data=z.read(info.filename)
        parts.append({'path':info.filename,'bytes':len(data),'sha256':digest(data)})
        if info.filename.startswith('word/') and info.filename.endswith('.xml'):
            tree=E.fromstring(data)
            for i,p in enumerate(tree.iter(w+'p')):
                nodes=list(p.iter(w+'t'))
                if nodes: paragraphs.append({'part':info.filename,'p':i,'text':''.join(n.text or '' for n in nodes),'nodes':[n.text or '' for n in nodes],'properties':E.tostring(p.find(w+'pPr'),encoding='unicode') if p.find(w+'pPr') is not None else '', 'runProperties':[E.tostring(r.find(w+'rPr'),encoding='unicode') if r.find(w+'rPr') is not None else '' for r in p.findall(w+'r')]})
    tree=E.fromstring(z.read('word/document.xml'))
    sections=[E.tostring(n,encoding='unicode') for n in tree.iter(w+'sectPr')]
    anchors=[{'tag':n.tag,'attributes':n.attrib} for n in tree.iter() if n.tag.rsplit('}',1)[-1] in ['anchor','shape','positionH','positionV','extent']]
    table_properties=[E.tostring(n,encoding='unicode') for n in tree.iter(w+'tblPr')]
evidence={'source':str(source),'sha256':digest(raw),'bytes':len(raw),'parts':parts,'sections':sections,'anchors':anchors,'tables':table_properties,'paragraphs':paragraphs}
(root/'inventory.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'sha256':evidence['sha256'],'parts':len(parts),'paragraphs':len(paragraphs),'anchors':len(anchors),'sections':len(sections)}))
assert source.read_bytes()==raw
