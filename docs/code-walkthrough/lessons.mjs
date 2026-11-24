/** Editorial source. Every lesson points to source extracted at build time. */
export const lessons=[];
const add=(group,title,file,symbol,goal,notes,edit,exercise)=>lessons.push({group,title,file,symbol,goal,notes:notes.map(([anchor,title,text])=>({anchor,title,text})),edit,exercise});
add('01 · อ่านภาษาและสัญญาข้อมูล','รู้จัก type ที่มาจากข้อมูลจริง','src/lib/templates.ts','@lines:15-18','อ่าน typeof, indexed access, literal union และ non-null assertion จากรายการแบบหนังสือ',[
 ['DocumentType','TS · typeof + [number]','typeof templates ขอชนิดของตัวแปร ส่วน [number] เลือกชนิดสมาชิกทุกตัวในอาร์เรย์ และ ["id"] เลือกเฉพาะ id ผลคือ union เช่น "external" | "internal" ไม่ใช่ string ใด ๆ ก็ได้'],
 ['as const','TS · literal และ readonly','บรรทัดปิดอาร์เรย์ใช้ as const จึงรักษาค่า id เป็น literal และชนิด readonly การประกาศนี้ช่วย compiler แต่ไม่ได้เรียก Object.freeze ข้อมูลขณะรัน'],
 ['find','JS + TS · เครื่องหมาย !','find อาจคืน undefined แต่ ! บอก compiler ว่าผู้เขียนมั่นใจว่าพบ ไม่ได้ตรวจตอนรัน หากรับ id จากภายนอก ต้องตรวจด้วย schema ก่อน'],
 ['new Set','JS · ทำรายการไม่ซ้ำ','map ดึง group แล้ว Set ตัดค่าซ้ำ ส่วน ... กระจายกลับเป็นอาร์เรย์ นี่คือพฤติกรรม JavaScript ไม่ใช่ระบบ type']
], 'เพิ่มแบบหนังสือเริ่มที่ templates แต่ต้องต่อ documentSchema, ตัวกรอก และ documentHtml ด้วย การเพิ่ม id อย่างเดียวไม่ได้สร้างรูปแบบพิมพ์ให้ครบ', 'ลองเขียน const t: DocumentType = "invoice"; ควรถูก compiler ปฏิเสธ จากนั้นเปลี่ยนเป็น "external" แล้วตรวจใหม่');
add('01 · อ่านภาษาและสัญญาข้อมูล','Schema ตรวจของจริง ไม่ใช่แค่ชนิด','src/lib/document.ts','@lines:1-12','แยกการตรวจขณะเขียนโค้ดกับการตรวจข้อมูลที่รับมาจริง',[
 ['z.object','Runtime · Zod','z.object สร้างตัวตรวจที่ทำงานจริงเมื่อเรียก parse ส่วน TypeScript type จะหายไปเมื่อแปลงเป็น JavaScript จึงใช้ type แทนการตรวจข้อมูลจากฟอร์มไม่ได้'],
 ['as [DocumentType','TS · tuple assertion','z.enum ต้องการรายการที่มีอย่างน้อยหนึ่งค่า จึงยืนยันเป็น tuple [ตัวแรก, ...ตัวที่เหลือ] นี่เป็นคำยืนยัน ไม่ได้ป้องกัน templates ว่างตอนรัน'],
 ['subject:','Runtime · ลำดับการตรวจ','trim ตัดช่องว่างหัวท้าย ก่อน min(1) จึงไม่ยอมให้หัวเรื่องมีแต่ช่องว่าง max(300) เป็นข้อจำกัดข้อมูลที่ทุกช่องทางบันทึกต้องผ่าน'],
 ['refine','JS · ตรวจวันจริง','regex ตรวจรูป YYYY-MM-DD แต่วันที่ 2026-02-31 ยังหน้าตาถูก จึงแปลง Date แล้วเทียบกลับกับข้อความเดิม รวมทั้งตรวจช่วงปี']
], 'ต้องการเพิ่ม field ให้เริ่มที่ schema พร้อม default ที่เหมาะกับร่างเก่า แล้วตามไป UI, render และ export อย่าเพิ่มเฉพาะช่องกรอก', 'ทายผล subject="   " และ date="2026-02-31" ทั้งสองต้องไม่ผ่าน parse ส่วน date="" ยังยอมรับเพื่อเปิดร่างระหว่างทำ');
add('01 · อ่านภาษาและสัญญาข้อมูล','Draft ต่างจาก SavedDraft อย่างไร','src/lib/document.ts','@lines:62-67','เห็นความต่างระหว่างรูปข้อมูลแบบฟอร์มกับข้อมูลที่บันทึกแล้ว',[
 ['z.infer','TS · infer จาก schema','Draft ดึงชนิดผลลัพธ์ของ documentSchema จึงลดการเขียน interface ซ้ำกับกติกา Zod ค่า default ทำให้ผล parse มี field ครบ แม้ input ส่งมาไม่ครบ'],
 ['SavedDraft','TS · intersection &','SavedDraft มีทุก field ของ Draft รวม id, version และเวลา ไม่ใช่คลาสสืบทอด ไม่มี new SavedDraft และไม่ได้สร้าง object ให้อัตโนมัติ'],
 ['string | null','TS · union','driveFileId เป็นข้อความหรือ null ต้องตรวจว่ามีค่าก่อนใช้ ต่างจาก property ที่ไม่ส่งมาเลยซึ่งมักใช้ ?'],
 ['newDraft','JS · factory function','newDraft สร้างร่างด้วย parse ให้ default ของ schema เติมค่าที่เหลือ type: DocumentType = "external" คือพารามิเตอร์มีชนิดและค่าเริ่มต้น']
], 'ห้ามรับ id/version ที่เพิ่งสร้างเองใน UI แทนค่าจากการบันทึก เพราะ version คือหลักฐานว่ากำลังแก้ฉบับล่าสุด', 'สร้าง newDraft("internal") แล้วดู subject, body, floatingItems อธิบายว่าค่าที่ไม่ได้ส่งเข้าฟังก์ชันมาจากไหน');
add('01 · อ่านภาษาและสัญญาข้อมูล','ปีปฏิทินกับปีงบประมาณ','src/lib/document.ts','documentYear','ฝึก destructuring, map, ternary และการใช้ union จำกัดทางเลือก',[
 ['mode:','TS · จำกัดค่าที่รับ','mode รับได้สองคำเท่านั้น calendar หรือ fiscal ทำให้เรียกผิด เช่น budget ถูกตรวจพบขณะพัฒนา'],
 ['[year, month]','JS · array destructuring','split แยกวันที่เป็นข้อความ แล้ว map(Number) เปลี่ยนเป็นตัวเลข ก่อนดึงปีและเดือนตามตำแหน่ง'],
 ['year + 543','JS · กฎธุรกิจ','เพิ่ม 543 เพื่อแสดง พ.ศ. และบวกอีกหนึ่งเมื่อเป็น fiscal ตั้งแต่เดือนตุลาคม ฟังก์ชันนี้ไม่ได้ตรวจว่าวันที่ถูกต้อง ต้องผ่าน schema มาก่อน']
], 'การจัดกลุ่มรายงานใช้ปีงบประมาณได้ แต่การจองเลขหนังสือใน db.ts ใช้ปีจากวันที่ ห้ามแทนทุกจุดด้วยกฎเดียวกันโดยไม่ตรวจเจตนา', 'documentYear("2026-10-01","fiscal") ต้องได้ 2570 ส่วน calendar ได้ 2569 เพิ่มกรณี 30 กันยายนในแบบฝึกหัด');
add('02 · จาก URL ถึงแบบฟอร์ม','หน้าแรก: Server ส่งข้อมูลให้ React','src/app/page.tsx','Page','ตามการเริ่มต้นระบบจาก Page ไปยัง Workspace',[
 ['Promise<','TS · ชนิดผลลัพธ์ในอนาคต','searchParams เป็น Promise ของ object ที่มี view/google แบบ optional ต้อง await ก่อนใช้ คำว่า Promise บอกชนิด ไม่ได้เป็นตัวรันงานเอง'],
 ['authenticated','Server · ด่านเข้า','ตรวจการเข้าใช้ก่อนอ่านข้อมูลให้หน้าเว็บ redirect เป็นการย้ายเส้นทาง หากระบบตั้งให้ไม่ต้องล็อกอิน authenticated จะคืน true ตาม auth.ts'],
 ['<Workspace','React · ส่ง props','JSX สร้าง element พร้อมข้อมูลเริ่มต้น เช่น initialDocuments={listDrafts()} ข้อมูลนี้ถูกอ่านบน server ไม่ใช่ SQL ใน browser'],
 ['savedOrganization','JS · เงื่อนไข + parse','มี setting จึง JSON.parse ไม่มีก็ null ค่า ! หลัง getSetting เป็นการยืนยันกับ TS จึงควรระวังข้อมูล setting ที่เสียรูป']
], 'เพิ่มข้อมูลเริ่มต้นใหม่ต้องเพิ่ม props ของ Workspace ให้ตรงกัน และอย่าส่ง connection ฐานข้อมูลหรือ secret ผ่าน props', 'ตาม initialDocuments ไปที่ Props และ useState ใน workspace.tsx แล้วหาเหตุผลว่าทำไมการพิมพ์ข้อความไม่ต้องเรียก Page ใหม่ทุกตัวอักษร');
add('02 · จาก URL ถึงแบบฟอร์ม','State และ ref อยู่คนละหน้าที่','src/components/workspace.tsx','@lines:50-57','อ่าน state ของร่าง ตัวเลือกหน้าจอ และเครื่องมือวางภาพ',[
 ['useState<Draft>','React + TS · state มีชนิด','useState<Draft>(newDraft()) เก็บร่างที่เปลี่ยนแล้วกระตุ้น render ส่วน <Draft> ช่วยตรวจว่าค่าถัดไปยังตรงรูปเดิม'],
 ['SavedDraft|null','TS · ยังไม่เคยบันทึก','saved เป็น null ได้ จึงต้องใช้ saved?.id ก่อนมีรหัสจริง อย่าใช้ object ว่างแล้ว cast เพื่อหลบการตรวจ'],
 ['useTransition','React · งานที่รอได้','isPending มาจาก transition ส่วน attachmentBusy เป็น state อีกตัวที่ใช้กับการอัปโหลด ไม่ใช่สัญญาณเดียวกันทุกงาน'],
 ['useRef','React · จำค่าโดยไม่ render','ref.current เปลี่ยนได้ทันทีและคงอยู่ข้าม render แต่ไม่ทำให้ภาพหน้าจออัปเดตเอง เหมาะกับค่าเครื่องมือที่ callback ต้องอ่านล่าสุด']
], 'เพิ่ม UI state เฉพาะหน้าที่ Workspace ได้ แต่ข้อมูลที่ต้องอยู่กับร่างต้องเข้า Draft และเส้นทางบันทึกด้วย', 'อธิบายว่าทำไมตั้ง overlayToolRef.current อย่างเดียวไม่พอให้ปุ่มเปลี่ยนสี ตรวจ setOverlayMode ที่อัปเดตทั้ง ref และ state');
add('02 · จาก URL ถึงแบบฟอร์ม','Component คือฟังก์ชันที่รับ props','src/components/document-form.tsx','Section','อ่าน React component ที่ใช้ซ้ำหลายหมวด ไม่ต้องใช้ class',[
 ['tone="green"','JS · destructuring พร้อม default','ฟังก์ชันดึง id/title/icon/children/tone ออกจาก object ทันที หากไม่มี tone ใช้ green รูปแบบนี้ยังเป็น JavaScript'],
 ['ReactNode','TS · ชนิดเนื้อหา React','icon และ children รับข้อความ element หรือเนื้อหาที่ React แสดงได้ ไม่ใช่ HTML string ที่ต้องต่อเอง'],
 ['`form-${id}`','JS · template literal','ประกอบ id เช่น form-body ให้ปุ่มทางลัดค้น section ได้ ชื่อ id จึงเป็นสัญญาระหว่างฟอร์มกับระบบเลื่อน'],
 ['{children}','React · ช่องใส่เนื้อหา','Section วาดกรอบและ summary แล้วให้ผู้เรียกส่ง field เข้ามา ใช้โครงสร้างเดียวกันโดยไม่คัดลอกทั้งแผง']
], 'ปรับหน้าตาหมวดแก้ Section และ document-form.css แต่การจัดกระดาษต้องแก้ render-document.ts ไม่ใช่ CSS ของฟอร์มนี้', 'ทดลองใช้ <Section id="contact" title="ผู้ประสานงาน" icon={...}>...</Section> แล้วตรวจว่า id ไม่ซ้ำหมวดเดิม');
add('02 · จาก URL ถึงแบบฟอร์ม','ทำตัวหนา: แก้ string และคืน cursor','src/components/body-editor.tsx','wrapBold','อ่าน callback ที่ใช้ DOM selection โดยไม่เปลี่ยนรูปข้อมูลเนื้อหา',[
 ['ref.current','TS · null guard','ก่อน textarea ถูกผูก ref ค่าเป็น null ได้ if (!input) return ทำให้บรรทัดถัดไปใช้ selectionStart ได้อย่างปลอดภัย'],
 ['value.slice','JS · string ไม่ถูกแก้ในที่เดิม','ตัดส่วนหน้า + **ข้อความ** + ส่วนท้าย เป็น next ใหม่ slice ไม่เปลี่ยน value เดิม เหมาะกับ React state'],
 ['onChange(next)','React · ส่งข้อมูลขึ้น parent','BodyEditor ไม่บันทึกฐานข้อมูลเอง แต่แจ้ง parent ให้เปลี่ยนร่าง เป็น controlled input'],
 ['requestAnimationFrame','Browser · คืนตำแหน่งเลือก','รอเฟรมถัดไปเพื่อ focus และเลือกเฉพาะข้อความใน **...** การทำตัวหนาจริงเกิดภายหลังที่ renderer แปลเครื่องหมายนี้']
], 'เพิ่มเครื่องหมายรูปแบบใหม่ต้องปรับทั้ง editor, ตัวแปล inline ใน render-document และ Word export ไม่ใช่เพิ่มปุ่มอย่างเดียว', 'เลือกคำกลางประโยคแล้วกดตัวหนา ตรวจว่าส่วนหน้า/ท้ายยังครบ และ cursor เลือกเฉพาะคำ ไม่รวม **');
add('02 · จาก URL ถึงแบบฟอร์ม','ตารางเกิดจากข้อความก่อนกลายเป็นเอกสาร','src/components/body-editor.tsx','insertTable','เชื่อมปุ่มตารางกับรูปแบบ pipe table ที่ตัวจัดหน้ารับได้',[
 ['insideBoldSelection','JS · ป้องกันแทรกผิดจุด','ตรวจว่าตำแหน่งเลือกอยู่ระหว่าง ** หรือไม่ หากใช่ ขยับผ่านเครื่องหมายปิดก่อนเริ่มตาราง'],
 ['const table','Data · รูปแบบกลาง','ข้อความมีหัวตาราง บรรทัด --- และแถวว่าง การแก้ syntax ต้องสอดคล้องกับ formattedLines ใน render-document.ts'],
 ['separator','JS · เติม newline เท่าที่ต้องใช้','ถ้ามีเนื้อหาก่อนและยังไม่ลงท้าย newline จึงเติมหนึ่งบรรทัด เพื่อให้ parser มองเห็นตารางเป็นส่วนใหม่'],
 ['setSelectionRange','UX · ลดขั้นตอนผู้ใช้','หลังแทรก เลื่อน cursor ไปช่องแรกของแถวข้อมูล ทำให้เริ่มกรอกได้ทันที']
], 'เพิ่มจำนวนคอลัมน์ที่ปุ่มนี้ได้ แต่ต้องทดสอบตารางกว้าง หน้าล้น และ Word แก้ไขต่อ การเปลี่ยน UI ไม่รับประกันว่ากระดาษจะพอดี', 'เปลี่ยนข้อความตัวอย่างเป็น 3 คอลัมน์ในสำเนาฝึก แล้วตรวจว่าจำนวน | ของหัว แถวคั่น และแถวข้อมูลเท่ากัน');
add('03 · บันทึกและฐานข้อมูล','persist: บันทึกโดยไม่ทับข้อความที่เพิ่งพิมพ์','src/components/workspace.tsx','persist','อ่าน await และ functional state update ในสถานการณ์ผู้ใช้ยังพิมพ์ระหว่างบันทึก',[
 ['submitted','JS · snapshot ก่อนรอ','JSON.stringify(draft) เก็บภาพข้อมูลที่ส่งตอนกดบันทึก ระหว่าง await ผู้ใช้อาจเปลี่ยน draft ไปแล้ว'],
 ['saveDocument','Boundary · ข้ามไป server','ส่ง draft พร้อม id/version ของร่างที่เคยบันทึก optional chaining ทำให้ร่างใหม่ส่ง undefined'],
 ['if(!result.ok)','TS · discriminated result','ตรวจ ok ก่อนใช้ data เพราะผลล้มเหลวมี error แทน data TS จึงรู้ว่าหลังผ่านเงื่อนไขแล้วใช้ result.data ได้'],
 ['setDraft(current','React · ใช้ state ล่าสุด','callback ได้ current ตอน React ประมวลผล ถ้ายังตรง submitted จึงแทนด้วย canonical หากพิมพ์เพิ่มแล้วจะเก็บ current ไว้ ป้องกันผลตอบกลับเก่าล้างงานใหม่']
], 'ห้ามย่อเป็น setDraft(canonical) ทุกครั้ง เพราะทำให้ข้อความที่พิมพ์ระหว่างรอหาย baseline คือฉบับที่บันทึกสำเร็จ ไม่ใช่ทุกสิ่งที่เห็นในช่องล่าสุด', 'ลองจำลองส่ง A แล้วพิมพ์ B ก่อน server ตอบ ค่าที่อยู่บนหน้าจอต้องเป็น B แต่ saved/baseline ต้องบอกฉบับ A ที่บันทึกจริง');
add('03 · บันทึกและฐานข้อมูล','Server Action: unknown ต้องผ่านการตรวจ','src/app/actions.ts','saveDocument','ตามข้อมูลจาก browser เข้าด่านตรวจ ก่อนแตะฐานข้อมูล',[
 ['input: unknown','TS · บังคับให้ตรวจ','unknown รับอะไรก็ได้แต่ใช้เป็น Draft ทันทีไม่ได้ documentSchema.parse คือจุดแปลงข้อมูลที่ไม่ไว้ใจเป็นข้อมูลที่ตรวจแล้ว'],
 ['requireUser','Server · ตรวจทุกช่องทาง','แม้หน้า UI ซ่อนปุ่ม ก็ยังต้องตรวจสิทธิ์ใน action เพราะผู้เรียกไม่จำเป็นต้องกดจากปุ่มนั้นเสมอ'],
 ['validateAttachments','Runtime · ความสัมพันธ์ข้อมูล','ตรวจ metadata ไฟล์และภาพกับข้อมูลที่เก็บจริง การผ่าน schema ของร่างอย่างเดียวไม่ได้พิสูจน์ว่าไฟล์นั้นมีอยู่'],
 ['as const','TS · คืนผลสองรูป','ok:true as const ทำให้ ok เป็น literal true ไม่ถูกขยายเป็น boolean ผู้เรียกจึงแยก success/error ได้จาก if'],
 ['instanceof','TS + JS · narrowing ของ error','catch รับค่าที่อาจไม่ใช่ Error ตรวจ ZodError ก่อนเพื่อดึงข้อความ field แล้วจึง Error ทั่วไปและข้อความสำรอง']
], 'กฎที่ทุกการบันทึกต้องบังคับควรอยู่ฝั่ง server ด้วย ส่วน reviewIssues ใช้เพิ่มความครบถ้วนเมื่อผู้ใช้เลือก reviewed', 'ส่ง input ผิดชนิดในชุดทดสอบ แล้วตรวจว่าได้ {ok:false,error} และไม่มีแถวใหม่ในฐานข้อมูลทดสอบ');
add('03 · บันทึกและฐานข้อมูล','คลาสจริง: SQLiteDatabase','src/lib/db.ts','SQLiteDatabase','คลี่ constructor, private, readonly, method และ generic transaction จากคลาสที่ระบบใช้จริง',[
 ['private readonly','TS · ขอบเขตและการกำหนดซ้ำ','private จำกัดการเข้าถึงผ่าน type checker readonly ห้ามกำหนด connection ใหม่หลังสร้าง แต่ยังเรียก method ที่เปลี่ยนฐานข้อมูลได้ ไม่ได้ทำ DB เป็น read-only'],
 ['constructor','JS · สร้าง instance','new SQLiteDatabase(file) เรียก constructor เพื่อเปิด DatabaseSync แล้วเก็บไว้ใน this.connection'],
 ['prepare(sql','Class · ห่อ dependency','method ส่งงานให้ connection ทำให้โค้ดข้างนอกใช้ API ชุดเล็กแทนผูกกับรายละเอียดทุกอย่างของ driver'],
 ['transaction<T>','TS · generic รักษาชนิดผลลัพธ์','T คือชนิดที่ operation คืน หาก operation คืน SavedDraft ฟังก์ชันที่ได้จาก transaction ก็คืน SavedDraft ไม่ต้อง cast'],
 ['return () =>','JS · ฟังก์ชันคืนฟังก์ชัน','transaction ยังไม่เริ่มจนเรียกฟังก์ชันที่คืนมา จึงเห็น db().transaction(() => {...})() วงเล็บท้ายเป็นการเริ่มงาน'],
 ['ROLLBACK','SQL · ทั้งชุดสำเร็จหรือย้อนกลับ','เริ่ม BEGIN IMMEDIATE แล้ว COMMIT เมื่อ operation ไม่โยน error ถ้ามี error จะ ROLLBACK และส่ง error ต่อ ห้ามส่ง async callback เพราะ wrapper นี้ไม่ await Promise']
], 'หากแก้ transaction ต้องทดสอบ rollback และชนิดค่าที่คืน อย่าใส่การอัปโหลด Drive ระหว่าง transaction เพราะงานเครือข่ายยาวและไม่ใช่ operation แบบ synchronous', 'ระบุว่า transaction(() => 123) มีชนิดอะไร คำตอบคือ () => number; ต้องเรียก () อีกครั้งจึงได้ 123');
add('03 · บันทึกและฐานข้อมูล','อ่านแถว SQL แล้วแปลงเป็นข้อมูลแอป','src/lib/db.ts','decode','เห็นการแยกชื่อคอลัมน์ฐานข้อมูลกับชื่อ property ที่ UI ใช้',[
 ['row: Row','TS · สัญญาของแถว','Row อธิบายคอลัมน์ที่ query คืน แต่ type ไม่ได้ตรวจฐานข้อมูลขณะรัน ส่วน JSON.parse ก็ยังรับข้อมูลผิดรูปได้'],
 ['documentSchema.parse','Runtime · ตรวจ JSON อีกชั้น','แปลง row.data จากข้อความกลับเป็น object แล้วผ่าน schema เพื่อเติม defaults และตรวจโครงสร้างร่าง'],
 ['...documentSchema','JS · ลำดับ spread มีผล','กระจาย field ของ Draft ก่อน แล้วเขียน id/version จากคอลัมน์จริงทีหลัง จึงไม่เชื่อ metadata ที่อาจฝังอยู่ใน JSON'],
 ['updatedAt','Mapping · snake_case → camelCase','updated_at ใน SQLite ถูกแปลงเป็น updatedAt ให้ TypeScript ส่วน signed_scan_count มาจาก query ที่นับไฟล์แนบแล้ว']
], 'เพิ่ม metadata ต้องแก้ query, Row และ decode ให้ตรงกัน ถ้าเพิ่ม field เนื้อหาร่างให้แก้ schema ที่เก็บใน JSON', 'ถ้า JSON มี version=99 แต่คอลัมน์ version=3 ผล decode ต้องได้ 3 เพราะ property ด้านหลังชนะ');
add('03 · บันทึกและฐานข้อมูล','ป้องกันสองหน้าต่างเขียนทับกัน','src/lib/db.ts','writeDraft','ดู optimistic concurrency, parameterized SQL และ audit ใน transaction เดียว',[
 ['JSON.stringify','Data · ร่างถูกเก็บอย่างไร','ข้อมูลแบบฟอร์มเก็บ JSON ในคอลัมน์ data ส่วน id/version/time แยกคอลัมน์เพื่อค้นหาและควบคุมการแก้ไข'],
 ['checkNumber','Business rule · เช็กเลขในชุดเดียวกัน','ตรวจเลขเมื่อสร้างใหม่หรือเลข/ปีเปลี่ยน ต้องอยู่ใน write transaction เพื่อไม่ให้ขั้นตรวจแยกจากขั้นเขียน'],
 ['AND version=?','SQL · เขียนเมื่อฐานยังตรง','UPDATE จะสำเร็จต่อเมื่อ id และ version ตรง ถ้าอีกหน้าต่างเขียนก่อน version เพิ่มแล้ว query นี้ไม่เปลี่ยนแถว'],
 ['result.changes','Runtime · ตรวจผลจริง','changes เป็นศูนย์จึงโยน error ให้ UI โหลดฉบับล่าสุด ไม่ใช่แค่เช็ก version ใน JavaScript ก่อน UPDATE'],
 ['INSERT INTO audit','Trace · บันทึกหลักฐาน','เพิ่ม audit หลังอ่านฉบับที่เขียนแล้ว ภายใน transaction เดียวกัน จึงไม่ควรมีเอกสารใหม่ที่ขาด audit เมื่อทั้งชุดสำเร็จ']
], 'ห้ามลบเงื่อนไข version เพื่อให้บันทึกผ่านง่ายขึ้น และใช้ placeholder ? แทนต่อข้อความผู้ใช้ลง SQL', 'จำลองอ่าน version=1 สองชุด บันทึกชุดแรกได้ version=2 ชุดที่สองต้อง error และเนื้อหาชุดแรกยังอยู่');
add('03 · บันทึกและฐานข้อมูล','ลบแบบกู้คืนได้','src/lib/db.ts','removeDraft','ตาม soft delete ไปยังรายการถังขยะและความเชื่อมโยงงบประมาณ',[
 ['deleted_at','SQL · ไม่ได้ DELETE แถว','กำหนดเวลาลบแทนลบทิ้ง listDrafts/readDraft กรอง deleted_at IS NULL จึงหายจากรายการปกติแต่กู้ได้'],
 ['version=version+1','Concurrency · การลบก็เป็นการแก้','เพิ่ม version และตรวจค่าที่ผู้ใช้ถืออยู่ ป้องกันลบร่างที่มีผู้อื่นแก้ใหม่แล้วโดยไม่รู้ตัว'],
 ['sqlite_master','SQL · ตรวจตารางที่สร้างภายหลัง','โมดูล budget อาจยังไม่เคยใช้งาน จึงตรวจว่ามีตารางก่อนล้างการเชื่อมโยงเอกสาร'],
 ['audit','Trace · บันทึกเหตุการณ์','เหตุการณ์ delete เก็บ version ที่คำสั่งใช้ ส่วน version ในแถวเอกสารถูกเพิ่มแล้ว อย่าสรุปว่า audit ทุก action คือ version หลังเขียนเสมอ']
], 'เพิ่มสิ่งที่อ้าง document_id ต้องกำหนดพฤติกรรมเมื่อลบ/กู้คืนด้วย และไม่ควรปล่อยการล้างลิงก์อยู่นอก transaction', 'ตาม listTrash และ restoreDraft ในไฟล์เดียวกัน อธิบายว่าเหตุใดเอกสารในถังขยะยังมีผลต่อการตรวจเลขซ้ำ');
add('04 · ตัวอย่างเอกสารและการส่งออก','Preview: ยกเลิกผลตอบกลับเก่า','src/components/workspace.tsx','@lines:89-98','อ่าน effect ที่สร้าง HTML และเปลี่ยน iframe เมื่อร่างเปลี่ยน',[
 ['view!==','React · ไม่ทำงานเมื่อไม่ต้องใช้','ออกทันทีเมื่อไม่อยู่ editor ช่วยลดงาน render เอกสารในหน้าที่ไม่ได้แสดง preview'],
 ['let active','JS · flag ต่อรอบ effect','แต่ละ effect มี active ของตัวเอง ผล import ที่ตอบช้าจะไม่เขียน state ถ้า effect รอบนั้นถูก cleanup แล้ว'],
 ['import(','Performance · โหลดเมื่อใช้','dynamic import คืน Promise แล้วค่อยได้ documentHtml ไม่ใช่การ import พร้อมทุกส่วนตั้งแต่เริ่มหน้า'],
 ['return()=>','React · cleanup','ตั้ง active=false เมื่อ dependencies เปลี่ยนหรือ component ถูกถอด ไม่ได้ยกเลิก import แต่ป้องกันผลเก่าเขียนทับ'],
 ['setFrameKey','React · เปลี่ยนตัวตน iframe','เพิ่ม key เพื่อให้กรอบตัวอย่างสร้างใหม่พร้อม HTML รอบล่าสุด เมื่อแก้จุดนี้ต้องตรวจตำแหน่ง scroll และการวางภาพร่วมด้วย']
], 'preview ไม่ขึ้นให้ตรวจ view, html, frameKey และข้อความตอบจาก iframe ก่อนเพิ่ม reload ทั้งหน้า ซึ่งอาจทำให้งานที่ยังไม่บันทึกหาย', 'ลองให้ร่าง A สร้างช้ากว่าร่าง B แล้วตรวจว่า A ที่ตอบภายหลังไม่กลับมาทับ B');
add('04 · ตัวอย่างเอกสารและการส่งออก','ลำดับเนื้อหาคือข้อมูล ไม่ใช่ CSS','src/lib/document.ts','bodySections','ดูว่าหัวข้อจากฟอร์มกลายเป็นรายการเนื้อหาได้อย่างไร',[
 ['minutes','Domain · แบบประชุมมีเส้นทางเฉพาะ','ตรวจชนิด minutes และโหมด agenda ก่อนเพื่อสร้างหัวข้อ ระเบียบวาระ และมติ ไม่ควรบังคับทุกแบบให้ใช้ชุดหัวข้อเดียวกัน'],
 ['flatMap','JS · หนึ่งรายการแตกได้หลายส่วน','แต่ละ agenda ให้หลาย section เช่น discussion และ resolution แล้ว flatMap ทำให้เป็นอาร์เรย์ระดับเดียว'],
 ['d.bodyMode','Domain · โหมดหัวข้อ','structured คืนหัวข้อเรียง เรื่องเดิม ข้อเท็จจริง ข้อระเบียบ/กฎหมาย ข้อพิจารณา แล้ว proposal ส่วน free ใช้ body'],
 ['d.proposal','Data · ข้อเสนอไม่มีหัวข้อในรายการนี้','proposal ถูกคืนเป็น section ที่ title ว่าง ส่วนการแสดงหรือซ่อนหัวข้อทั้งชุดจาก sectionHeadings อยู่ใน renderer ไม่ใช่ฟังก์ชันนี้']
], 'ต้องการสลับหัวข้อให้แก้ลำดับที่นี่และ UI ให้สอดคล้อง ไม่ใช่ใช้ CSS order เฉพาะหน้าจอ เพราะ export เรียกข้อมูลจากฟังก์ชันนี้', 'ใส่ข้อความสั้นต่างกันในทั้งห้าช่อง แล้วตรวจลำดับใน preview, PDF และ Word เทียบกัน');
add('04 · ตัวอย่างเอกสารและการส่งออก','Escape HTML ก่อนสร้างเอกสาร','src/lib/render-document.ts','escapeHtml','อ่านฟังก์ชันเล็กที่ป้องกันข้อมูลผู้ใช้กลายเป็น tag',[
 ['replace','JS · แทนอักขระสำคัญ','&, <, >, เครื่องหมายคำพูดถูกแทนเป็น HTML entities เมื่อแทรกใน HTML จะเห็นเป็นข้อความแทนการสร้าง element'],
 ['s:string','TS · ขอบเขตข้อมูล','รับ string ตามสัญญา แต่ไม่ได้หมายความว่าข้อความนั้นปลอดภัย ต้องทำ escaping จริงเสมอ'],
 ['=>','JS · callback','callback ถูกเรียกต่ออักขระที่ regex พบ แล้วเลือก entity จาก mapping สั้น ๆ แทน if หลายบรรทัด']
], 'ส่วนใหม่ใน documentHtml ที่รับข้อความผู้ใช้ต้องใช้ escape helper ในบริบทที่ถูกต้อง อย่าเอา HTML จาก textarea มาต่อโดยตรง', 'ทดสอบหัวเรื่อง <img src=x> ต้องแสดงตัวอักษรตามนั้น ไม่เกิดภาพหรือ element ใหม่ใน preview');
add('04 · ตัวอย่างเอกสารและการส่งออก','HTML ไปเป็น PDF','src/lib/pdf.ts','renderPdf','ตามเส้นทางเรียก Chromium จัดหน้า ตรวจความครบถ้วน และส่งไฟล์กลับ',[
 ['validateAppendixImages','Runtime · ตรวจต้นทาง','ตรวจภาพและเตรียมแหล่งภาพก่อน render ลดโอกาสได้ PDF ที่เว้นพื้นที่ภาพแต่ไม่มีภาพจริง'],
 ['launch','Server · browser สำหรับพิมพ์','เปิด Chromium แบบ headless บนเครื่อง server ต้องมี executable ที่รองรับ จึงเกี่ยวกับชุดติดตั้ง ไม่ใช่แค่ component หน้าเว็บ'],
 ['setContent','Rendering · ใช้ต้นฉบับเดียว','ใส่ HTML ที่ documentHtml สร้าง แล้วรอการแบ่งหน้า ไม่ใช่พิมพ์ screenshot ของแบบฟอร์มกรอกข้อมูล'],
 ['page.pdf','Output · กระดาษ A4','พิมพ์ตาม CSS และขนาดกระดาษ จากนั้นจัดรวมเอกสารแนบตาม logic appendAttachments'],
 ['finally','JS · คืนทรัพยากรแม้ผิดพลาด','ปิด browser ทั้งกรณีสำเร็จและ error ไม่เช่นนั้น export หลายครั้งจะทิ้ง process ค้าง']
], 'ปรับระยะเอกสารเริ่มจาก renderer และตรวจทั้งตัวอย่างกับ PDF ไม่ใช่เพิ่ม scale ที่ PDF จนหน้าดูพอดีแต่ระยะราชการเปลี่ยน', 'จำลองภาพขาดหรือ overlay อยู่หน้าที่ไม่มีจริง ผลต้องเป็น error ที่เข้าใจได้ ไม่ส่ง PDF ที่ตกหล่นโดยเงียบ ๆ');
add('04 · ตัวอย่างเอกสารและการส่งออก','ชนิดกลางสำหรับ Word','src/lib/word-layout.ts','@lines:3-8','อ่าน intersection, array และ union ที่แทนย่อหน้า ตาราง และภาพ',[
 ['WordRun','Type · ช่วงข้อความ','run เก็บข้อความที่ใช้ style เดียวกัน พร้อม bold/underline/size/color ย่อหน้าหนึ่งมีหลาย run ได้'],
 ['Box','Type · พิกัดร่วม','Box มี x/y/width/height แล้ว WordParagraph = Box & {...} เพิ่มข้อมูลย่อหน้า โดยไม่มี inheritance ตอนรัน'],
 ["kind: 'table'",'TS · discriminant','kind แยกชนิด block เมื่อเช็ก kind==="table" compiler จะยอมให้เข้าถึง rows ไม่ใช่ runs ของ paragraph'],
 ['WordPage','Model · หน้าหนึ่งมีสองชั้น','blocks เป็นเนื้อหาหลักที่แก้ไขใน Word ส่วน overlays เป็นวัตถุลอย เช่น ภาพหรือข้อความที่วางตำแหน่งไว้']
], 'เพิ่มชนิด block ต้องปรับตัวดึง layout และตัวสร้าง DOCX พร้อมกัน มิฉะนั้น type เพิ่มแล้วแต่ export ยังไม่รู้วิธีเขียน', 'เขียนฟังก์ชันรับ WordParagraph | WordTable แล้วคืนจำนวน run หรือจำนวน row โดยใช้ if (block.kind === ...) ห้ามใช้ any');
add('04 · ตัวอย่างเอกสารและการส่งออก','สร้างย่อหน้า Word แบบกระจายไทย','src/lib/word.ts','paragraph','เชื่อมพิกัดจาก browser กับ Paragraph ของไลบรารี docx',[
 ['IParagraphOptions','TS · ตรวจ options ก่อนสร้าง','object options มีชนิดที่ไลบรารีกำหนด ช่วยจับชื่อ option ผิดก่อนสร้างไฟล์'],
 ['THAI_DISTRIBUTE','Document · แปลความหมาย align','เมื่อ layout เป็น justify จะใช้ Thai Distribute ส่วน center/right/left คงความหมายของแต่ละย่อหน้า ไม่ได้ทำทั้งเอกสารเป็นกระจายไทย'],
 ['twip','Units · หน่วยไม่เหมือน CSS','ตำแหน่งจาก browser เป็น px แต่ Word ใช้ twip จึงแปลงก่อนกำหนด spacing/indent/tabs ห้ามส่ง px เข้าไปตรง ๆ'],
 ['keepNext','Pagination · ยึดส่วนที่สัมพันธ์กัน','keepNext และ keepLines มีผลต่อการย้ายย่อหน้าใน Word ต้องลองเอกสารยาว ไม่ใช่ดูแค่หน้าแรก'],
 ['new Paragraph','Library · สร้าง object จริง','ต่างจาก type alias ในบทก่อน ตรงนี้ new เรียกคลาสของ docx เพื่อสร้างโครงสร้างที่จะถูกเขียนลงไฟล์']
], 'แก้การกระจายคำที่ย่อหน้าของ Word ให้ตรวจ textRuns และ wordJoin ด้วย อย่าเพิ่ม newline กลางย่อหน้าเพื่อบังคับหน้าตา', 'สร้างเอกสารที่มีหัวเรื่องกึ่งกลางและเนื้อหากระจายไทย เปิด Word แล้วตรวจสองส่วนนี้ยังใช้ alignment ต่างกัน');
add('04 · ตัวอย่างเอกสารและการส่งออก','HTTP route ส่ง Word ให้ดาวน์โหลด','src/app/api/documents/[id]/word/route.ts','GET','เห็นทั้ง status code, binary response และ error ที่ควรแสดงกับผู้ใช้',[
 ['await params','Next · path parameter','โฟลเดอร์ [id] จับรหัสจาก URL โดย params เป็น Promise ต้อง await ก่อนนำ id ไปอ่านร่าง'],
 ['safeParse','Runtime · ตรวจโดยไม่ throw','safeParse คืนผล success ให้ใช้ if แล้วตอบ 400 ต่างจาก parse ที่โยน error เมื่อข้อมูลผิด'],
 ['new Uint8Array','HTTP · ส่ง binary','renderWord คืน Buffer ฝั่ง Node จากนั้นส่งข้อมูลไบต์ให้ NextResponse พร้อม MIME ของ docx ไม่ใช่ส่ง JSON'],
 ['Content-Disposition','HTTP · ชื่อไฟล์ภาษาไทย','attachment บอกให้ดาวน์โหลด และ filename*=UTF-8 ช่วยส่งชื่อเรื่องไทยที่ encodeURIComponent แล้ว'],
 ['MissingOverlayPageError','Error · แยกข้อผิดพลาดที่คาดไว้','ข้อผิดพลาดวางภาพบนหน้าที่ไม่มีแล้วตอบ 422 ส่วนความล้มเหลวทั่วไปตอบ 500 โดยไม่ส่งรายละเอียดระบบทั้งหมดให้ผู้ใช้']
], 'เพิ่ม export ใหม่ต้องมีการตรวจสิทธิ์ id, MIME, ชื่อไฟล์ และข้อความผิดพลาดให้ครบ อย่าใช้ 200 กับไฟล์ที่สร้างไม่สำเร็จ', 'ลอง id ไม่ใช่ UUID ต้องได้ 400; UUID ที่ไม่มีได้ 404; ร่างที่ถูกต้องต้องมี MIME docx และเปิดใน Word ได้');
add('04 · ตัวอย่างเอกสารและการส่งออก','Error subclass ที่ UI เข้าใจได้','src/lib/export-validation.ts','MissingOverlayPageError','เทียบคลาสสืบทอดกับ type intersection ที่เรียนไปแล้ว',[
 ['extends Error','JS · inheritance ตอนรัน','คลาสนี้เป็น Error จริง ใช้ instanceof แยกได้ ต่างจาก type alias ที่หายไปหลัง compile'],
 ['pages:number[]','TS · รายการเลขหน้า','constructor รับ array ตัวเลขเพื่อนำไปบอกว่าภาพหรือข้อความลอยอยู่หน้าใดที่หายไป'],
 ['super(','JS · เรียกคลาสแม่','ต้องเรียก super ก่อนใช้ this ใน constructor ของคลาสลูก ข้อความถูกเก็บใน error.message'],
 ['this.name','Debug · ชื่อใน log','กำหนดชื่อให้อ่าน stack trace รู้ว่าเป็นปัญหาจัดหน้าเฉพาะชนิด ไม่ใช่ Error ที่ไม่ทราบต้นเหตุ']
], 'เพิ่ม error เฉพาะเรื่องเมื่อผู้ใช้แก้ได้และ route ต้องจัดการต่างกัน ไม่จำเป็นต้องสร้างคลาสใหม่ทุกข้อความเตือน', 'สร้าง instance ในแบบฝึกหัด ตรวจ e instanceof Error และ e.message โดยไม่ต้องเปิด browser');
add('05 · ภาพ ลายเซ็น และภาษาไทย','เลือกชนิดภาพด้วย Extract / Pick / Partial','src/lib/floating-item.ts','@lines:1-11','อ่าน utility types ในฟังก์ชันวางภาพบนกระดาษ A4',[
 ['Extract<','TS · กรอง union','Draft["floatingItems"][number] มี text และ image; Extract<...,{kind:"image"}> เลือกเฉพาะชนิดภาพ จึงอ่าน item.image ได้'],
 ['item is FloatingImage','TS · type predicate','isSignature คืน boolean และช่วย narrow ชนิดเมื่อ true แต่ false ไม่ได้แปลว่าเป็นข้อความเสมอ อาจเป็นภาพที่ไม่ได้ระบุ purpose signature'],
 ['Partial<Pick','TS · patch จำกัด field','Pick เลือกเฉพาะ xMm/yMm/widthMm/page แล้ว Partial ทำให้ส่งบาง field ได้ ไม่อนุญาตให้ patch ข้อมูลไฟล์ภาพ'],
 ['...item,...patch','JS · merge ไม่แก้ต้นฉบับ','copy item แล้วให้ค่าจาก patch เขียนทับ คำนวณ ratio จากภาพเดิมเพื่อรักษาสัดส่วน'],
 ['Math.max','Geometry · clamp','จำกัดความกว้างและตำแหน่งให้อยู่ใน A4 210×297 มม. round ลดทศนิยมเหลือหนึ่งตำแหน่ง ความสูงมาจาก width × ratio']
], 'ภาพลายเซ็นที่วางเป็นภาพประกอบ ไม่ใช่ลายเซ็นดิจิทัลแบบใบรับรอง การเปลี่ยนขนาดต้องใช้ geometry ชุดเดียวกับ preview/export', 'ภาพ 400×200 px กว้าง 100 มม. ต้องสูง 50 มม. ทดลอง patch xMm=190 แล้วหาว่าขอบขวาจะถูกจำกัดที่ใด');
add('05 · ภาพ ลายเซ็น และภาษาไทย','ตามภาพจาก metadata ถึง bytes','src/lib/appendix.ts','appendixSources','เห็นว่าร่างเก็บข้อมูลภาพและอ้างไฟล์จริงอย่างไร',[
 ['Record<string,string>','TS · dictionary','ผลเป็น object ที่ key คือ image id และ value คือ data URL ใช้ Record เพื่อบอกชนิด mapping ไม่ใช่สร้าง class ใหม่'],
 ['kind==="image"','TS · narrowing ผ่าน filter','เลือกเฉพาะภาพจาก floatingItems แล้ว map เอา image ออก รวมกับ appendixImages ด้วย spread'],
 ['readAppendixImage','Data · ตรวจไฟล์ที่เก็บ','อ่าน BLOB จากฐานข้อมูลแล้วเทียบ mime/ขนาด/จำนวนไบต์กับ metadata ของร่าง หากไม่ตรงให้หยุด ไม่แอบใช้รูปอื่น'],
 ['base64','Rendering · ภาพอยู่ใน HTML','แปลง bytes เป็น data URL ทำให้ renderer มีภาพครบในตัว ไม่ต้องร้องขอ URL ภายนอกตอนพิมพ์']
], 'เพิ่มประเภทไฟล์ใหม่ต้องแก้ schema, ตัวตรวจ bytes และ renderer พร้อมกัน การเปลี่ยนแค่ accept ของช่อง upload ไม่พอ', 'แก้ metadata width ของภาพในชุดทดสอบให้ผิด ผลต้อง error ก่อน export ไม่ใช่พิมพ์ภาพผิดสัดส่วน');
add('05 · ภาพ ลายเซ็น และภาษาไทย','คลังคำ: เลือกวลีที่ไม่ควรแยกบรรทัด','src/lib/thai-dictionary.ts','thaiKeepTerms','ฝึก filter, some, map, Set และ sort จากงานภาษาไทย',[
 ['defaultThaiPairs.filter','Data · ค่าผู้ใช้ทับค่าเริ่มต้น','ตัดคำเริ่มต้นที่มี entry ชื่อเดียวกันออกก่อน เพื่อให้ผู้ใช้ยกเลิก keepTogether ของคำเดิมได้'],
 ['keepTogether','Business · คำที่แก้สะกดไม่ใช่คำยึด','เลือก entry ที่ keepTogether และไม่มี correction แยกหน้าที่คำควบกับคู่คำผิด→ถูก'],
 ['new Set','JS · ตัดรายการซ้ำ','รวมสองแหล่งแล้ว Set ทำให้ไม่มีคำซ้ำ ก่อนกระจายเป็นอาร์เรย์'],
 ['b.length-a.length','Algorithm · คำยาวก่อน','เรียงยาวไปสั้น ลดโอกาสคำสั้นถูกจับก่อนวลีที่ครอบมัน เช่น ปีงบประมาณ กับ งบประมาณ']
], 'เปลี่ยนรายการคำผ่านหน้าคลังคำได้ ส่วนปรับอัลกอริทึมต้องตรวจ thai-layout และ wordJoin ให้ PDF/Word ใช้ความหมายสอดคล้องกัน', 'เพิ่มคำ default เดิมโดย keepTogether=false และ correction="" แล้วตรวจว่าคำนั้นไม่อยู่ในผลลัพธ์');
add('05 · ภาพ ลายเซ็น และภาษาไทย','Word joiner ต่างจากการขึ้นบรรทัดใหม่','src/lib/thai-dictionary.ts','wordJoin','เรียน Unicode grapheme และอักขระที่ควบคุมจุดตัดบรรทัด',[
 ['Intl.Segmenter','Runtime · แยกตาม grapheme','grapheme คือกลุ่มอักขระที่แสดงร่วมกัน ไม่ใช่แยกทุก UTF-16 code unit จึงเหมาะกว่าการ split("") กับภาษาไทย'],
 ['Array.from','JS · iterable เป็น array','Segmenter คืน iterable แล้ว callback s=>s.segment ดึงข้อความแต่ละกลุ่มออกมา'],
 ['\\u2060','Unicode · ยึดจุดต่อ','join แทรก WORD JOINER ระหว่างกลุ่มเพื่อห้ามตัดตรงนั้น ไม่ใช่ newline และไม่ใช่ช่องว่างที่เห็นได้']
], 'อย่าใส่ wordJoin ให้ทั้งย่อหน้า เพราะจะบีบให้ทั้งย่อหน้าไม่ตัดบรรทัด ใช้เฉพาะวลีที่กำหนด และเก็บข้อความดิบให้แก้ไขได้', 'อ่าน textRuns ใน word.ts เพื่อดูว่า keepGroup ถูกส่งมาจากไหน และทำไม run ที่ติดกันในกลุ่มเดียวกันต้องมี joiner เพิ่มระหว่าง run');
add('05 · ภาพ ลายเซ็น และภาษาไทย','ตรวจคำ: unknown ไม่ได้แปลว่าสะกดผิด','src/lib/thai-proofread.ts','analyzeThai','ตามลำดับวลีที่ยอมรับ คู่คำแนะนำ และคำที่ควรตรวจด้วยคน',[
 ['accepted=','Data · แยกบทบาท entries','รายการที่ไม่มี correction เป็นคำที่ยอมรับ ส่วนรายการมี correction ใช้ทับคำแนะนำเริ่มต้นผ่าน object spread'],
 ['covered','Algorithm · ช่วงข้อความที่รู้จัก','เก็บ start/end ของวลีที่ยอมรับทั้งหมด เพื่อไม่แจ้งเตือนคำย่อยที่อยู่ในวลีเหล่านั้น'],
 ['Object.entries(corrections)','Rule · แนะนำจากรายการชัดเจน','ใช้ indexOf หาแต่ละคำแนะนำ ตอนนี้หา occurrence แรกของคำนั้น ไม่ได้ให้ตำแหน่งทุกครั้งที่ซ้ำในข้อความ'],
 ['granularity:\'word\'','Runtime · ตัดคำด้วย ICU','Segmenter ตัดคำไทย แล้วเช็กกับ lexicon/seen/covered/ช่วง issue ที่ทับกัน เพื่อลดการเตือนซ้ำ'],
 ["kind:'unknown'",'Product · ขอให้ตรวจ ไม่ตัดสิน','ชื่อเฉพาะและคำหน่วยงานอาจไม่มีในพจนานุกรม ต้องแสดงว่าให้ตรวจทาน ไม่ควรแก้ข้อความอัตโนมัติ'],
 ['truncated','Limit · แจ้งว่าผลถูกจำกัด','หยุดที่ 80 issues และคืน truncated เพื่อให้ UI บอกผู้ใช้ว่ามีขีดจำกัด ไม่ใช่ประกาศว่าตรวจครบทุกจุดแล้ว']
], 'หากต้องการชี้คำผิดซ้ำทุก occurrence ให้แก้ loop correction พร้อมทดสอบตำแหน่ง start/end อย่าแก้ index ด้วยการนับตัวอักษรที่เห็นด้วยตา', 'ข้อความมีชื่อหน่วยงานเฉพาะ ต้องกดเพิ่มคลังคำแล้วลดคำเตือนได้ โดยไม่เปลี่ยนเนื้อหาเอกสาร');
add('06 · ทะเบียนและงานพัสดุ','ทะเบียนรับส่ง: เลขและประวัติมาพร้อมกัน','src/lib/correspondence-db.ts','saveRegister','อ่าน request replay, เลขทะเบียนต่อกอง/ปี และ event snapshot',[
 ['request_id','Reliability · ส่งซ้ำไม่สร้างรายการใหม่','ตรวจ requestId ของรายการใหม่ หากเคยบันทึกแล้วและข้อมูลเหมือนเดิม คืนรายการเดิม หาก payload เปลี่ยนให้ error'],
 ['input.documentId','Relation · ตรวจร่างที่เชื่อม','การเก็บ id อย่างเดียวไม่พอ ต้องตรวจว่าร่างยังอยู่และไม่ถูกลบ รวมทั้งห้าม relatedId อ้างตัวเอง'],
 ['old.department','Rule · เลขออกแล้วเปลี่ยนขอบเขตไม่ได้','การแก้ไขห้ามย้ายกอง ประเภทรับ/ส่ง หรือปี เพราะ serial ถูกออกภายใต้ขอบเขตนั้น'],
 ['MAX(serial)','SQL · ลำดับต่อขอบเขต','หาเลขล่าสุดเฉพาะ department_key/direction/year ภายใน transaction แล้ว +1 หรือใช้ startNumber ในชุดแรก'],
 ['correspondence_events','Audit · snapshot ของเหตุการณ์','เก็บข้อมูลหลังเขียนพร้อม actor/reason เวลา ทำให้ตามประวัติได้ actor เป็นชื่อที่กรอก ไม่ใช่หลักฐานยืนยันตัวบุคคลจากบัญชีผู้ใช้']
], 'เพิ่ม filter ค้นหาใน UI ได้ แต่กฎออกเลขและเหตุผลแก้ไขต้องอยู่ที่ server อย่าใช้จำนวนแถวที่ browser เห็นเป็นเลขใหม่', 'ส่งคำขอ requestId เดิมสองครั้ง ต้องมีทะเบียนเดียวและเลขเดียว; ใช้ requestId เดิมกับเรื่องใหม่ต้องถูกปฏิเสธ');
add('06 · ทะเบียนและงานพัสดุ','กติกาใบเบิกที่ตรวจหลาย field ร่วมกัน','src/lib/inventory.ts','movementSchema','อ่าน schema และ superRefine ของใบรับ เบิก ยืม',[
 ['z.enum','Domain · สามกระบวนการ','receive/issue/loan มีความหมายต่างกัน แม้ใช้หน้ากรอกและรายการวัสดุร่วมกัน'],
 ['lines:z.array','Runtime · ตรวจแถวก่อนรวมใบ','แต่ละแถวมี itemId UUID, quantity เป็นจำนวนเต็มบวก และ unitCost ไม่ติดลบ จำกัดสูงสุด 100 แถว'],
 ['superRefine','Runtime · กฎข้าม field','ตรวจรายการซ้ำ วันคืนก่อนวันยืม และการรับเข้าต้องมีเอกสารอ้างอิง ซึ่งตรวจจาก field เดียวไม่พอ'],
 ['path:','UX · error อยู่ตรงช่อง','addIssue ระบุ path เช่น lines หรือ due ช่วยผู้เรียกรู้ว่าต้องแก้ข้อมูลส่วนใด']
], 'อย่าเปลี่ยนให้จำนวนติดลบเพื่อคืนของ การคืนเป็น action อีกชนิดที่มีประวัติ ส่วนปริมาณทศนิยมจะกระทบ schema, หน่วยนับ และรายงาน', 'ลอง lines ที่ itemId ซ้ำ และ loan ที่ due ก่อน date ทั้งสองต้องไม่ผ่าน แม้ field แต่ละตัวถูกชนิด');
add('06 · ทะเบียนและงานพัสดุ','ลงบัญชี: ตัดสต็อกครั้งเดียว','src/lib/inventory-db.ts','transitionMovement','อ่าน state transition ที่ป้องกันตัดสต็อกซ้ำและไม่ให้ยอดติดลบ',[
 ['.parse(input)','Runtime · ตรวจคำสั่ง','action, id, version, actor และข้อมูลอนุมัติถูกตรวจอีกครั้งก่อนอ่านรายการจริง'],
 ["m.status==='posted'",'Idempotency · ตอบคำขอเดิม','ถ้าคำสั่งมีผลลัพธ์ปลายทางนั้นแล้ว คืนรายการเดิมก่อนแก้ยอด เพื่อไม่ตัด stock ซ้ำเพราะกดซ้ำหรือ response หาย'],
 ['m.version!==','Concurrency · คำสั่งใหม่ต้องทันข้อมูล','ถ้ายังต้องเปลี่ยนสถานะและ version ไม่ตรง หยุดให้โหลดใหม่ ไม่ใช้ร่างเก่าลงบัญชี'],
 ['const delta','Stock · รับบวก จ่าย/ยืมลบ','คำนวณ delta ต่อแถวและตรวจ balance+delta ก่อน UPDATE ทุกแถวอยู่ใน transaction เดียว แถวท้ายผิดจึงย้อนแถวก่อนด้วย'],
 ["p.action==='return'",'State · คืนเฉพาะที่ยืมอยู่','ต้องเป็น loan ที่ posted และระบุสภาพเมื่อคืน จึงเพิ่ม balance กลับและเก็บผู้รับคืน'],
 ["m.status='cancelled'",'Audit · ยกเลิกไม่ลบประวัติ','ยกเลิกได้เฉพาะ draft การจ่ายที่ลงบัญชีแล้วไม่ถูกย้อนด้วยปุ่มยกเลิกแบบไม่มีเอกสารหลักฐาน']
], 'เปลี่ยนขั้นอนุมัติให้แก้ state transition และ action validation พร้อมทดสอบยอดก่อน/หลัง ไม่ใช่เปิดปุ่ม post ใน UI อย่างเดียว', 'เริ่ม balance=5 เบิก 2 ยืนยันซ้ำสองครั้งต้องเหลือ 3; เบิก 6 ต้อง error และยังเหลือ 5 ในชุดทดสอบอีกชุด');
add('06 · ทะเบียนและงานพัสดุ','ยอดคำนวณในฟอร์มไม่ควรเดาข้อมูล','src/lib/inventory-forms.ts','calculatedRows','ฝึก immutability และการแยกช่องว่างออกจากเลขศูนย์',[
 ['d.rows.map','JS · แปลงโดยไม่แก้ต้นฉบับ','map สร้างอาร์เรย์ใหม่ และ {...r} สร้าง row ใหม่ ผู้ใช้แก้ร่างเดิมได้โดยไม่ถูกคำนวณแทรกระหว่างอ่าน'],
 ['[2,3,5]','Domain · เฉพาะฟอร์มที่มีมูลค่า','templateId เหล่านี้ใช้ quantity × unitCost ฟอร์มชนิดอื่นไม่ถูกเติม total โดยไม่เกี่ยวกับงาน'],
 ['Number.isFinite','Runtime · เลขต้องใช้ได้จริง','เช็ก trim ก่อนแปลง Number เพราะ Number("") ได้ 0 ทั้งที่ผู้ใช้ยังไม่กรอก แล้วตรวจ finite เพื่อไม่ให้ NaN/Infinity ลงรายงาน'],
 ["total=",'Output · ไม่ครบให้เว้นว่าง','หากข้อมูลยังไม่ครบ ผลเป็นช่องว่างแทนเดาว่าเป็นศูนย์ ช่วยไม่ให้รายงานตีความว่าราคาเป็นศูนย์จริง']
], 'เพิ่มสูตรใหม่ต้องระบุฟอร์มที่ใช้และวิธีปัดเศษ พร้อมแยกค่าไม่ทราบกับค่า 0 ไม่ควรใช้ || 0 ทุกช่อง', 'quantity="2", unitCost="" ต้อง total ว่าง; unitCost="0" ต้องได้ผลศูนย์ที่ถูก format แล้ว');
add('06 · ทะเบียนและงานพัสดุ','ฟอร์มพัสดุใช้เครื่องจัดหน้าเดียวกับหนังสือ','src/lib/inventory-form-render.ts','@lines:31-35','เห็นจุดเชื่อม bodyBlocks ไป documentHtml โดยไม่สร้างระบบพิมพ์แยก',[
 ['d.signers','Layout · กลุ่มลายเซ็น','สร้างกลุ่ม signature ต่อผู้ลงนาม เพื่อให้ตัวจัดหน้ารักษากลุ่มชื่อและตำแหน่งไว้ด้วยกัน'],
 ['newDraft','Reuse · สร้างฐานข้อมูลเอกสารกลาง','เลือก internal สำหรับแบบ 8 และ other สำหรับแบบอื่น จากนั้นกำหนด subject/หน่วยงาน/วันที่จากร่างพัสดุ'],
 ['DocumentAssets','TS · asset ต้องครบสัญญา','สร้าง fullAssets ให้ตรงชนิดที่ renderer ต้องใช้ พร้อมค่า fallback ฟอนต์ ส่วนตราที่ไม่ใช้ส่งค่าว่าง'],
 ['bodyBlocks:blocks','Extension point · ส่งเนื้อหาที่เตรียมแล้ว','documentHtml รับ bodyBlocks เป็นทางเข้าพิเศษ จึงใช้พื้นฐานหน้า/ฟอนต์/ส่งออกเดิมกับตารางพัสดุได้']
], 'ปรับคอลัมน์ฟอร์มพัสดุเริ่มที่ inventory-forms.ts และตัวประกอบ blocks ในไฟล์นี้ ระยะฐานกระดาษยังอยู่ที่ documentHtml', 'ตาม wordParagraphs ว่าถูกส่งมาจาก export Word อย่างไร แล้วเปิด PDF/Word ของฟอร์มเดียวกันเทียบเนื้อหา');
add('06 · ทะเบียนและงานพัสดุ','รายงาน: นิยามตัวเลขก่อนวาดกราฟ','src/lib/inventory-analytics.ts','@lines:4-14','อ่านช่วงเวลา เปรียบเทียบงวด และ demand ที่ใช้ทำรายงาน',[
 ['const from','Date · เริ่มช่วงจากข้อมูล','เมื่อไม่ระบุ start ใช้วันที่เคลื่อนไหวที่ลงบัญชีครั้งแรก หรือ today หากไม่มีข้อมูล'],
 ['const to','Date · ไม่ทำนายอนาคต','จำกัดปลายช่วงไม่ให้เกิน today และใช้ days อย่างน้อย 1 ป้องกันหารด้วยศูนย์'],
 ['previousStart','Analysis · เปรียบเทียบช่วงยาวเท่ากัน','งวดก่อนมีจำนวนวันเท่ากับงวดที่เลือก ทำให้เปรียบเทียบจำนวนใบได้บนช่วงเวลาขนาดเดียวกัน'],
 ['new Map','JS · รวมตาม key','issueCounts นับจำนวนรายการที่ปรากฏ quantities รวมจำนวนของ ส่วน departments นับใบเบิก ไม่ใช่บวกจำนวนวัสดุต่างหน่วยรวมกัน'],
 ['coverage:','Analysis · ประมาณ ไม่ใช่ข้อเท็จจริงอนาคต','balance × days ÷ quantity เป็นจำนวนวันที่คาดว่าเหลือจากอัตราใช้ในงวด หากไม่มีการใช้คืน null ไม่ใช่ 0 วัน ยอด balance เป็นยอดปัจจุบัน']
], 'ก่อนเพิ่ม KPI ต้องเขียนนิยามว่าใช้ยอดปัจจุบันหรือย้อนหลัง และนับใบ/ชิ้น/มูลค่า อย่าเปลี่ยนแค่ชื่อกราฟให้ดูน่าเชื่อถือ', 'เหลือ 10 ชิ้น ใช้ 20 ชิ้นใน 30 วัน coverage ได้ 15 วัน แต่ถ้าไม่มีประวัติเบิกต้องไม่แสดงว่าเพียงพอ 0 วัน');
add('07 · โมดูลร่วมและความปลอดภัยข้อมูล','ทะเบียนหน่วยงาน: กันซ้ำและแก้แบบมี version','src/lib/organization-directory-db.ts','saveDirectory','ตาม CRUD ที่ใช้กรอกข้อมูลหน่วยงานอัตโนมัติ',[
 ['command.parse','Runtime · ตรวจทั้งคำสั่ง','id/version/input มีสัญญาร่วมกัน สร้างใหม่ใช้ version=0 ส่วนการแก้ต้องตรงรายการเก่า'],
 ['c.version===0','Reliability · สร้างซ้ำแบบเดิม','ถ้ารหัสเดิมและ payload เหมือนเดิมตอนสร้าง สามารถคืนข้อมูลเดิมได้ ไม่สร้างหน่วยงานซ้ำ'],
 ["normalize('NFKC')",'Text · key เพื่อเปรียบเทียบ','ปรับรูป Unicode, lower case, ช่องว่างติดกันและหัวท้าย เพื่อเปรียบเทียบชื่อที่หมายถึงรายการเดียวกัน'],
 ['some(o=>','Business · คู่ชื่อกับฝ่าย','ตรวจ duplicate ทั้ง name และ department จึงรองรับหน่วยงานชื่อเดียวแต่คนละฝ่ายได้'],
 ['c.version+1','Concurrency · บอก revision ใหม่','ผลตอบกลับมี version ใหม่ที่ UI ต้องเก็บไว้ใช้ครั้งหน้า ไม่ควรเก็บ version เดิมหลัง save']
], 'การเลือกหน่วยงานเติมค่าลงร่างเป็น snapshot การแก้สมุดรายชื่อไม่ควรไปเปลี่ยนเอกสารเก่าที่ออกแล้ว', 'สร้างชื่อเดียวกันโดยเพิ่มช่องว่างซ้ำ ต้องถูกมองว่าซ้ำ ส่วนชื่อเดียวกันแต่ department ต่างให้ตรวจตามกติกาที่ต้องการ');
add('07 · โมดูลร่วมและความปลอดภัยข้อมูล','จองห้อง: ช่วงเวลาทับกันหรือไม่','src/lib/booking.ts','clashes','เรียน pure function ที่ทดสอบได้โดยไม่เปิดเว็บหรือฐานข้อมูล',[
 ['bookings.filter','JS · คืนเฉพาะที่ชน','ไม่เปลี่ยนอาร์เรย์เดิม คืนรายการที่ตรงเงื่อนไขให้ผู้เรียกตัดสินว่าจะปฏิเสธการจองอย่างไร'],
 ['exceptId','Edit · ยกเว้นตัวเอง','การแก้รายการเดิมต้องไม่นับว่าชนกับตัวเอง จึงมี exceptId แบบ optional'],
 ['b.status','Domain · เฉพาะรายการจองจริง','รายการยกเลิก ห้องอื่น หรือคนละวันไม่ถูกนำมาวัดการทับเวลา'],
 ['minutes(b.start)','Interval · สองเงื่อนไขต้องจริง','เริ่มเดิมก่อนจบใหม่+buffer และจบเดิม+buffer ก่อนเริ่มใหม่ยังไม่พ้น ใช้ < กับ > ทำให้แตะขอบพอดีไม่ถือว่าชนเมื่อไม่มี buffer']
], 'ปรับเวลาพักห้องต้องตรวจทั้ง buffer ของคำขอใหม่และ b.bufferMinutes ของของเดิม อย่าเทียบเวลาเป็นเลขชั่วโมงอย่างเดียว', 'เดิม 09:00–10:00 ใหม่ 10:00–11:00 ไม่มี buffer ต้องไม่ชน แต่เมื่อเดิมมี buffer 15 นาทีต้องชน');
add('07 · โมดูลร่วมและความปลอดภัยข้อมูล','สำรองอัตโนมัติ: อ่านสถานะอย่างไร','src/lib/automatic-backup.ts','automaticBackupStatus','อ่าน settings, fallback, nullish coalescing และเวลารอบถัดไป',[
 ['state=empty','Resilience · รูปสถานะเริ่มต้น','เริ่มจาก empty แล้ว merge JSON ที่อ่านได้ ถ้า JSON เสีย catch คงสถานะเริ่มต้นไว้ ไม่ทำให้หน้า settings ล่มจากการอ่านสถานะ'],
 ['??24','JS · ต่างจาก ||','?? ใช้ค่า 24 เมื่อไม่มีค่าเท่านั้น สำหรับโค้ดนี้ setting เป็น string จึงยังต้อง Number ก่อนใช้ ค่า "0" หมายถึงปิดรอบสำรอง'],
 ['lease','Coordination · งานยังถือสิทธิ์อยู่','running ดู lease ที่ยังไม่หมดเวลา ไม่ได้ตรวจว่า process ระบบปฏิบัติการยังทำงานอยู่โดยตรง'],
 ['lastSuccess','Status · เวลาที่สำเร็จจริง','nextDue คำนวณจาก lastSuccess ไม่ใช่ lastAttempt เพราะพยายามแล้วล้มเหลวยังไม่นับว่าสำรองล่าสุดสำเร็จ']
], 'เพิ่มตารางใหม่ต้องอัปเดต backup/restore allowlist และ validators ด้วย การเห็นเวลาสำรองสำเร็จไม่ได้พิสูจน์ว่าตารางใหม่ถูกรวมแล้ว', 'แยกสถานการณ์ยังไม่เคยสำรอง สำรองล้มเหลว และปิดรอบ=0 ว่า UI ควรแสดงอย่างไร โดยอย่าใส่เวลาสำเร็จปลอม');
add('07 · โมดูลร่วมและความปลอดภัยข้อมูล','Drive: Promise type และการลองซ้ำ','src/lib/drive.ts','@lines:34-48','อ่าน Awaited/ReturnType และการสร้างโฟลเดอร์ที่ลดปัญหาซ้ำเมื่อ response หาย',[
 ['Awaited<','TS · ถอดชนิดจากฟังก์ชัน','ReturnType<typeof driveClient> ได้ Promise ของ client แล้ว Awaited ดึงชนิด client ภายในออก ลดการเขียน type API ซ้ำ'],
 ['Promise<string>','TS · async คืน id ในอนาคต','ensureFolder คืน Promise ที่ resolve เป็นรหัสโฟลเดอร์ ผู้เรียกจึงต้อง await ก่อนใช้เป็น parent'],
 ['escapeDriveQuery','Query · escape ตามระบบปลายทาง','name/parent ถูกประกอบใน Drive query จึงต้อง escape ตาม syntax ของ Drive ไม่ใช้ HTML escape แทน'],
 ['cacheKey','Reliability · จอง id ก่อนสร้าง','เก็บ id ที่ generate ได้ก่อนเรียก create ทำให้ลองซ้ำใช้ id เดิมได้ และตรวจไฟล์เดิมก่อนสร้างใหม่'],
 ['code?:number','TS · assertion ของ error','cast ช่วยอ่าน code แต่ไม่ได้พิสูจน์ว่า error มีรูปนี้จริง branch 404 ต่างจาก network error ที่ต้อง throw ต่อ']
], 'อย่าใส่ token หรือ secret ใน log/คู่มือ และอย่ารวมงาน Drive ที่ใช้ await ไว้ใน SQLite transaction แบบ sync', 'ถ้า list พบโฟลเดอร์เดิม ฟังก์ชันควร return ก่อน create; ถ้า files.get ล้มด้วย 500 ต้องไม่กลืนเป็น “ไม่พบ”');
add('08 · ทดสอบและฝึกต่อ','ทดสอบกับฐานข้อมูลชั่วคราว','tests/db.test.ts','@lines:1-10','อ่าน setup/teardown ที่ทำให้ฝึก CRUD โดยไม่แตะงานผู้ใช้',[
 ['mkdtempSync','Test · โฟลเดอร์ใหม่เฉพาะรอบ','สร้างตำแหน่งชั่วคราวชื่อไม่ชนกัน ให้ไฟล์ทดสอบแยกจาก data/sarabun.sqlite จริง'],
 ['beforeAll','Test · กำหนดก่อนเปิด DB','ตั้ง DATABASE_PATH ก่อนเรียก db ครั้งแรก เพราะ db.ts cache connection ไว้ใน globalThis'],
 ['afterAll','Lifecycle · ปิดก่อนลบ','ปิด connection แล้วจึงล้างโฟลเดอร์ทดสอบ บน Windows ไฟล์ที่ยังเปิดอยู่อาจลบไม่ได้'],
 ['describe','Test · จัดกลุ่มพฤติกรรม','ชื่อ persistent CRUD บอกว่าทดสอบการเก็บและอ่านจริง ไม่ใช่แค่ mock ฟังก์ชันให้คืนค่าที่ต้องการ']
], 'อย่ารัน E2E ที่เขียนข้อมูลบน port 3000 ซึ่งใช้งานจริง ใช้ตัวแยกสภาพทดสอบใน scripts/test-release.mjs และตรวจค่า env ก่อนเสมอ', 'อธิบายว่าทำไมย้าย DATABASE_PATH ไปหลัง db() ไม่ได้ และทำไมต้องตรวจเส้นทางก่อนลบโฟลเดอร์ชั่วคราว');
add('08 · ทดสอบและฝึกต่อ','ทดสอบความเสียหายที่ต้องไม่เกิด','tests/db.test.ts','@lines:20-20','อ่านการทดสอบ stale update และ stale delete แบบตรวจผลที่คงอยู่ด้วย',[
 ['new content','Arrange · สร้างฉบับใหม่กว่า','สร้างร่าง แล้วเขียนเนื้อหาใหม่ด้วย version=1 ให้ฐานข้อมูลกลายเป็น version=2 ก่อนลองคำสั่งเก่า'],
 ['toThrow','Act / Assert · คำสั่งเก่าต้องล้ม','ทั้ง writeDraft และ removeDraft ที่ยังถือ version=1 ต้อง error ไม่ใช่แค่ปิดปุ่มใน UI'],
 ['readDraft(d.id).body','Assert · ตรวจผลปลายทางด้วย','หลังคำสั่งล้ม ต้องอ่านข้อมูลกลับว่า new content ยังอยู่ เพื่อยืนยันว่าไม่ได้ throw หลังเขียนทับไปแล้ว'],
 ['removeDraft(d.id,2)','Cleanup · ใช้ version ล่าสุด','ล้างรายการทดสอบด้วย version ที่ถูกต้อง ปิดงานทดสอบโดยไม่เหลือข้อมูลรบกวนกรณีถัดไป']
], 'เมื่อแก้ concurrency ต้องมี test ที่อ่านผลหลังความผิดพลาด ไม่เพียงตรวจว่า error ถูกโยน เพราะ transaction อาจผิดลำดับได้', 'เพิ่ม assertion ว่า version ยังเป็น 2 หลัง stale update ล้ม แล้วจึงลบด้วย version=2');
