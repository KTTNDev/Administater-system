import {afterEach,expect,it,vi} from 'vitest';
import {buildWritingPrompt,writingContext,writingRequestSchema} from '../src/lib/ai-writing';
import {generateWriting,listWritingModels} from '../src/lib/gemini-writing';
import {POST} from '../src/app/api/ai-writing/route';
vi.mock('../src/lib/auth',()=>({authenticated:vi.fn(async()=>true)}));
import {authenticated} from '../src/lib/auth';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();vi.mocked(authenticated).mockResolvedValue(true);});
const fields={task:'draft' as const,instruction:'ขออนุมัติประชุม โดยไม่ทราบวัน',context:'ผู้เข้าร่วม 10 คน'};
const key='test-only-not-a-real-secret';
const signal=()=>new AbortController().signal;
function request(body:unknown,origin='http://localhost:3000'){
 return new Request('http://localhost:3000/api/ai-writing',{method:'POST',headers:{host:'localhost:3000',origin,'content-type':'application/json'},body:JSON.stringify(body)});
}
it('builds a Thai fact-bound prompt without HTML and strips editor-only markers from context',()=>{
 const prompt=buildWritingPrompt(fields);expect(prompt).toContain('ห้ามแต่งชื่อ');expect(prompt).toContain('[ต้องระบุข้อมูล]');expect(prompt).toContain(fields.context);
 expect(writingContext('## หัวข้อ\n[space=-0.3]**คำ**[/space]\u2028ต่อ')).toBe('หัวข้อ\nคำ\nต่อ');
});
it('rejects arbitrary model URLs, header injection, and excessive user input',()=>{
 expect(writingRequestSchema.safeParse({action:'generate',apiKey:key,...fields,model:'https://evil.test/'}).success).toBe(false);
 expect(writingRequestSchema.safeParse({action:'models',apiKey:'bad\r\nkey'}).success).toBe(false);
 expect(writingRequestSchema.safeParse({action:'generate',apiKey:key,...fields,instruction:'x'.repeat(8001),model:'models/example-flash'}).success).toBe(false);
});
it('loads available text models, paginates, and keeps the key in a header only',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({models:[{name:'models/example',displayName:'Example',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']},{name:'../bad',supportedGenerationMethods:['generateContent']}],nextPageToken:'page2'})).mockResolvedValueOnce(Response.json({models:[{name:'models/second',supportedGenerationMethods:['generateContent']}]}));vi.stubGlobal('fetch',fetcher);
 const models=await listWritingModels(key,signal());expect(models.map(m=>m.name)).toEqual(['models/example','models/second']);
 expect(fetcher.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
 for(const [url,options] of fetcher.mock.calls){expect(url).not.toContain(key);expect(options.headers['x-goog-api-key']).toBe(key);expect(options.cache).toBe('no-store');}
 expect(fetcher.mock.calls[1][0]).toContain('pageToken=page2');
});
it('returns visible response parts and flags truncation without returning model thoughts',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'hidden',thought:true},{text:'ร่างข้อความ'}]}}]})));
 expect(await generateWriting({...fields,apiKey:key,model:'models/example'},signal())).toEqual({text:'ร่างข้อความ',truncated:true});
});
it('does not expose upstream error content or keys',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:{message:key+' private text'}},{status:403})));
 await expect(generateWriting({...fields,apiKey:key,model:'models/example'},signal())).rejects.toThrow('ตรวจสอบ API key');
});
it('reports safety-blocked or empty answers',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({promptFeedback:{blockReason:'SAFETY'}})));
 await expect(generateWriting({...fields,apiKey:key,model:'models/example'},signal())).rejects.toThrow('ไม่ได้ส่งคำตอบ');
});
it('rejects unrelated websites, absent origins and signed-out users before calling Google',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 expect((await POST(request({action:'models',apiKey:key},'https://evil.test'))).status).toBe(403);
 expect((await POST(request({action:'models',apiKey:key},''))).status).toBe(403);
 vi.mocked(authenticated).mockResolvedValue(false);expect((await POST(request({action:'models',apiKey:key}))).status).toBe(401);expect(fetcher).not.toHaveBeenCalled();
});
it('validates input and limits both declared and streamed bodies',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 expect((await POST(request({action:'models'}))).status).toBe(400);
 expect((await POST(request({action:'models',apiKey:key,context:'x'.repeat(100000)}))).status).toBe(413);
 const declared=request({action:'models',apiKey:key});declared.headers.set('content-length','100000');expect((await POST(declared)).status).toBe(413);
 expect(fetcher).not.toHaveBeenCalled();
});
it('returns a useful quota error without leaking provider data and disables caching',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:{message:key}},{status:429})));
 const response=await POST(request({action:'generate',apiKey:key,...fields,model:'models/example'}));expect(response.status).toBe(429);expect(response.headers.get('cache-control')).toBe('no-store');const text=await response.text();expect(text).toContain('โควตา');expect(text).not.toContain(key);
});
it('passes the user cancellation signal through to the provider',async()=>{
 const controller=new AbortController();controller.abort();
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{expect(options.signal.aborted).toBe(true);throw new DOMException('Aborted','AbortError');}));
 const req=request({action:'models',apiKey:key});const aborted=new Request(req,{signal:controller.signal});expect((await POST(aborted)).status).toBe(408);
});
