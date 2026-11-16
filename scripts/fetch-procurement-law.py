from pathlib import Path
from urllib.request import urlopen,Request
import hashlib,json,concurrent.futures
root=Path(__file__).resolve().parent.parent/'output/procurement-law-20261115'
root.mkdir(parents=True,exist_ok=True)
sources={
 'w119-2561':'https://www.gprocurement.go.th/wps/wcm/connect/ba660ab0-769a-46d2-ae1c-02fa954050ba/%E0%B8%A7119_07-03-2561.pdf?MOD=AJPERES',
 'w322-2560':'https://cpb.ddc.moph.go.th/ddc-pic/doc/86/pdf',
 'w804-2568':'https://cpb.ddc.moph.go.th/ddc-pic/doc/201/pdf',
 'limits-2560':'https://cpb.ddc.moph.go.th/ddc-pic/doc/103/pdf',
 'regulation-v3-2569':'https://cpb.ddc.moph.go.th/ddc-pic/doc/227/pdf',
}
def fetch(item):
 name,url=item
 try:
  dest=root/(name+'.pdf')
  if dest.exists(): data=dest.read_bytes()
  else:
   with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35) as response: data=response.read(20_000_001)
   if len(data)>20_000_000 or not data.startswith(b'%PDF'):raise ValueError('Not a bounded PDF')
   dest.write_bytes(data)
  return {'name':name,'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 except Exception as e:return {'name':name,'url':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: result=list(pool.map(fetch,sources.items()))
(root/'sources.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result))
