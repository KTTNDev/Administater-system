from pathlib import Path
import json,subprocess,sys
from pypdf import PdfReader
from PIL import Image,ImageDraw
folder=Path(sys.argv[1]);dest=folder/'pages';dest.mkdir(exist_ok=True)
poppler=Path('C:/Users/PR-StartUp/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
thumbs=[];report={}
for pdf in sorted(folder.glob('*.pdf')):
 report[pdf.name]=len(PdfReader(pdf).pages)
 prefix=dest/pdf.stem
 subprocess.run([str(poppler),'-png','-r','120',str(pdf),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 for page_index in range(1,report[pdf.name]+1):
  p=dest/(pdf.stem+'-'+str(page_index).zfill(len(str(report[pdf.name])))+'.png')
  im=Image.open(p).convert('RGB');im.thumbnail((310,440));tile=Image.new('RGB',(330,480),'#ddd');tile.paste(im,((330-im.width)//2,30));ImageDraw.Draw(tile).text((8,8),p.stem,fill='black');thumbs.append(tile)
for start in range(0,len(thumbs),8):
 part=thumbs[start:start+8];canvas=Image.new('RGB',(1320,480*((len(part)+3)//4)),'#aaa')
 for j,im in enumerate(part):canvas.paste(im,((j%4)*330,(j//4)*480))
 canvas.save(dest/('sheet-'+str(start//8+1)+'.png'))
(dest/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
