from pathlib import Path
import json, pdfplumber
root=Path('output/procurement-correspondence');result={}
for folder in ['short','long']:
 for file in sorted((root/folder).glob('*.pdf')):
  with pdfplumber.open(file) as doc:
   for index,page in enumerate(doc.pages):
    outside=[c for c in page.chars if c.get('text','').strip() and (c['bottom']>page.height-5 or c['x0']<5 or c['x1']>page.width-5)]
    assert not outside,(str(file),index,'text outside page')
   first=doc.pages[0]
   rules=[c for c in first.rects+first.curves if 80<c['top']<190 and c['bottom']-c['top']<1.5]
   assert any(c['x1']>538 for c in rules),(str(file),'header guide does not reach text margin')
   if folder=='short' and file.stem in ['D01','D07']:
    pairs=[]
    for page in doc.pages:
     lines=page.extract_text_lines()
     name=next((line for line in lines if line['text']=='(นาย ก)'),None)
     if not name:continue
     position=next(line for line in lines if 'เจ้าพนักงานธุรการปฏิบัติงาน'==line['text'])
     assert abs((name['x0']+name['x1']-position['x0']-position['x1'])/2)<1
     pairs.append(True)
    assert pairs,(str(file),'missing proposer')
   result[folder+'/'+file.name]={'pages':len(doc.pages),'fullWidthDepartment':True,'noClippedText':True}
(root/'geometry-verified.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ok':True,'documents':len(result),'pages':sum(d['pages'] for d in result.values())}))
