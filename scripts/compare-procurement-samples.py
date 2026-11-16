"""Read-only DOC/DOCX text audit. Legacy DOC follows MS-DOC CLX/PlcPcd text pieces.
No Office automation, macros, document repairs, or writes to source folders.
"""
from pathlib import Path
import struct,json,hashlib,zipfile,xml.etree.ElementTree as ET,re,sys
U=lambda b,o:struct.unpack_from('<I',b,o)[0]
def doc_text(data):
 if data[:8]!=bytes.fromhex('D0CF11E0A1B11AE1'):raise ValueError('Not CFB')
 size=1<<struct.unpack_from('<H',data,30)[0];mini=1<<struct.unpack_from('<H',data,32)[0]
 sector=lambda n:data[(n+1)*size:(n+2)*size]
 difat=list(struct.unpack_from('<109I',data,76));n=U(data,68)
 for _ in range(U(data,72)):
  s=sector(n);difat.extend(struct.unpack_from('<'+str(size//4-1)+'I',s));n=U(s,size-4)
 fat=[]
 for n in difat:
  if n<0xfffffffa:fat.extend(struct.unpack('<'+str(size//4)+'I',sector(n)))
 def chain(start,table,get):
  parts=[];seen=set();n=start
  while n<0xfffffffa:
   if n in seen or n>=len(table):raise ValueError('Invalid CFB chain')
   seen.add(n);parts.append(get(n));n=table[n]
  return b''.join(parts)
 directory=chain(U(data,48),fat,sector);entries={}
 for offset in range(0,len(directory),128):
  entry=directory[offset:offset+128];length=struct.unpack_from('<H',entry,64)[0]
  if length>=2:entries[entry[:length-2].decode('utf-16le')]=(entry[66],U(entry,116),struct.unpack_from('<Q',entry,120)[0])
 root=next(value for value in entries.values() if value[0]==5);small=chain(root[1],fat,sector)[:root[2]]
 mf=chain(U(data,60),fat,sector);minifat=list(struct.unpack('<'+str(len(mf)//4)+'I',mf)) if mf else []
 def stream(name):
  _,start,length=entries[name]
  return (chain(start,minifat,lambda n:small[n*mini:(n+1)*mini]) if length<U(data,56) else chain(start,fat,sector))[:length]
 word=stream('WordDocument');flags=struct.unpack_from('<H',word,10)[0]
 if flags&0x0100:raise ValueError('Encrypted DOC is unsupported')
 table=stream('1Table' if flags&0x0200 else '0Table');csw=struct.unpack_from('<H',word,32)[0];cslw_offset=34+csw*2;cslw=struct.unpack_from('<H',word,cslw_offset)[0];pairs=cslw_offset+2+cslw*4+2
 fc,length=struct.unpack_from('<II',word,pairs+33*8);clx=table[fc:fc+length];offset=0
 while clx[offset]==1:offset+=3+struct.unpack_from('<H',clx,offset+1)[0]
 if clx[offset]!=2:raise ValueError('Missing Pcdt')
 length=U(clx,offset+1);plc=clx[offset+5:offset+5+length];count=(length-4)//12;cps=struct.unpack_from('<'+str(count+1)+'I',plc);result=[]
 for i in range(count):
  encoded=U(plc,4*(count+1)+i*8+2);compressed=bool(encoded&0x40000000);position=encoded&0x3fffffff;chars=cps[i+1]-cps[i]
  if compressed:result.append(word[position//2:position//2+chars].decode('cp1252',errors='replace'))
  else:result.append(word[position:position+chars*2].decode('utf-16le',errors='strict'))
 return ''.join(result)
def extract(file):
 data=file.read_bytes();before=hashlib.sha256(data).hexdigest()
 if data[:4]==b'PK\x03\x04':
  with zipfile.ZipFile(file) as archive:
   root=ET.fromstring(archive.read('word/document.xml'));ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
   text='\n'.join(''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in root.findall('.//w:p',ns))
 else:text=doc_text(data)
 assert hashlib.sha256(file.read_bytes()).hexdigest()==before
 return {'name':file.name,'sha256':before,'paragraphs':[p.strip() for p in re.split(r'[\r\n\x07]',text) if p.strip()],'originalUnchanged':True}
if __name__=='__main__':
 sys.stdout.reconfigure(encoding='utf-8');root=Path(__file__).resolve().parents[1];output=root/'output/procurement-samples';output.mkdir(parents=True,exist_ok=True)
 for name,folder in [('original',Path(r'C:\Users\PR-StartUp\Desktop\ตัวอย่างไฟล์งาน')),('1360',Path(r'C:\Users\PR-StartUp\Desktop\1.ยอด 1360'))]:
  documents=[extract(file) for file in sorted(folder.iterdir()) if not file.name.startswith('~$') and file.suffix.lower() in ['.doc','.docx']]
  (output/(name+'-text.json')).write_text(json.dumps(documents,ensure_ascii=False,indent=2),encoding='utf-8');print(name,len(documents),'files; original hashes unchanged')
  if name=='1360':
   for document in documents:
    if document['name'].startswith(('1.ขอ','7.')):print(document['name'],'\n'+'\n'.join(document['paragraphs'][:40]))
