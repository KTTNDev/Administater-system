from pathlib import Path
from zipfile import ZipFile
import json,re,base64,unicodedata
from lxml import etree as E
import pdfplumber

folder=Path('output/procurement-multipage')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
def norm(s):
    s=unicodedata.normalize('NFC',s).translate(str.maketrans('๐๑๒๓๔๕๖๗๘๙','0123456789'))
    return re.sub(r'[\s\u200b\u2060]','',s)
def skeleton(s):return re.sub('[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]','',norm(unicodedata.normalize('NFKD',s)))
report={}
for i in range(1,15):
    code=f'D{i:02d}';z=ZipFile(folder/(code+'.docx'))
    assert any(name.startswith('word/fonts/sarabun-new-') for name in z.namelist()),(code,'missing embedded font')
    settings=E.fromstring(z.read('word/settings.xml'))
    context=settings.xpath('//w:docVar[@w:name="SarabunContinuationV2"]/@w:val',namespaces=ns)[0]
    info=json.loads(base64.b64decode(context))
    footer=E.fromstring(z.read('word/footer1.xml'));instructions=''.join(footer.xpath('//w:instrText/text()',namespaces=ns))
    cues={int(n):text for n,text in re.findall(r'=\s*(\d+)\s+"([^"]*)"\s*""',instructions)}
    label='ใบต่อบันทึกข้อความ' if info['memo'] else 'ใบต่อเอกสาร'
    with pdfplumber.open(folder/(code+'.pdf')) as pdf:
        assert len(pdf.pages)>1,code
        assert len(cues)==len(pdf.pages)-1,(code,'cue count')
        for index,page in enumerate(pdf.pages):
            notechars=sorted([c for c in page.chars if c['text'].strip() and c['top']>page.height-85 and c['size']<12.5],key=lambda c:(round(c['top']),c['x0']))
            notetext=norm(''.join(c['text'] for c in notechars))
            if index==0:assert norm(label) not in notetext,(code,index,'note on first page')
            else:
                for value in [label,info['subject'],info['number'],info['date']]:
                    if value:assert skeleton(value) in skeleton(notetext),(code,index,'note mismatch',value,notetext)
                header=norm(page.crop((0,0,page.width,60)).extract_text() or '')
                assert f'-{index+1}-' in header,(code,index,'page number',header)
            lines={}
            for c in page.chars:
                if c['top']>page.height-100 and c['size']>=14:
                    lines.setdefault(round(c['top']),[]).append(c)
            candidates=[]
            for chars in lines.values():
                chars.sort(key=lambda c:c['x0']);text=norm(''.join(c['text'] for c in chars))
                if text.endswith('...') and min(c['x0'] for c in chars)>page.width*.4:candidates.append((text,chars))
            if index==len(pdf.pages)-1:assert not candidates,(code,index,'cue on last page')
            else:
                cue=norm(cues[index+1]);selected=next((chars for text,chars in candidates if skeleton(text)==skeleton(cue)),None)
                assert selected,(code,index,'cue not rendered',cue,[v[0] for v in candidates])
                following=pdf.pages[index+1];region=following.crop((0,20,following.width,following.height-85));body=''.join(c['text'] for c in sorted(region.chars,key=lambda c:(round(c['top']),c['x0'])) if not re.search(r'Wingdings|Webdings|Symbol',c['fontname'],re.I))
                assert skeleton(cue[:-3]) in skeleton(body),(code,index,'cue not on following page',cue)
                bodychars=[c for c in page.chars if c['text'].strip() and c['size']>=14 and c not in selected and c['top']<page.height-45]
                assert max((c['bottom'] for c in bodychars),default=0)<=min(c['top'] for c in selected)+2,(code,index,'body/cue overlap')
                if index and notechars:assert max(c['bottom'] for c in selected)<=min(c['top'] for c in notechars)+2,(code,index,'cue/note overlap')
        report[code]={'pages':len(pdf.pages),'cues':len(cues),'notes':len(pdf.pages)-1,'matchingNextPage':True}
(folder/'continuations-verified.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ok':True,'documents':len(report),'pages':sum(d['pages'] for d in report.values())}))
