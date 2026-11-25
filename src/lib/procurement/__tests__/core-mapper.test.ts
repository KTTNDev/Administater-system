import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {documentSchema} from '../../document';
import {documentHtml} from '../../render-document';
import {templateFixture} from './templates-fixtures';
import {defaultAgency} from '../presets/default-agency';
import {CORE_DOC_IDS,mapProcurementCaseToDrafts,syncProcurementDraft} from '../core/mapper';
import {emptyMaster,newCase} from '../workspace/model';
import {sampleHireCase} from '../workspace/samples';

it('maps all fifteen documents, including e-GP alternatives, without changing the input',()=>{
  for(const total of [1520,22890]){
    const input=templateFixture(total),before=structuredClone(input),mapped=mapProcurementCaseToDrafts(input,defaultAgency);
    expect(mapped.map(item=>item.docId)).toEqual(CORE_DOC_IDS);
    expect(mapped.filter(item=>item.draft.type==='internal')).toHaveLength(8);
    expect(mapped.filter(item=>item.draft.type==='other')).toHaveLength(4);
    for(const item of mapped){expect(documentSchema.safeParse(item.draft).success).toBe(true);expect(item.draft.numeralStyle).toBe('thai');expect(item.draft.body).not.toBe('');}
    for(const item of mapped)expect(item.draft.procurementSource).toEqual({caseId:input.id,docId:item.docId});
    expect(input).toEqual(before);
    expect(mapped.find(item=>item.docId==='10')?.copies).toBe(2);
    expect(mapped.find(item=>item.docId==='6.2')?.copies).toBe(3);
    expect(mapped.find(item=>item.docId==='9')?.draft.number).toContain('/4511');
    expect(mapped.find(item=>item.docId==='9')?.draft.department).toContain(defaultAgency.subDepartmentFooter);
    expect(mapped.find(item=>item.docId==='1')?.draft.phone).toBe(defaultAgency.phoneDisplay);
    expect(mapped.find(item=>item.docId==='11.1')?.draft.phone).toBe('');
    expect(mapped.find(item=>item.docId==='8')?.draft.number).toBe('');
  }
});

it('uses shared item totals, inclusive VAT, Thai amount words and the actual inspector',()=>{
  const input=templateFixture(),mapped=mapProcurementCaseToDrafts(input,defaultAgency),po=mapped.find(item=>item.docId==='10')!.draft;
  expect(po.body).toContain('๑,๕๒๐.๐๐');expect(po.body).toContain('๙๙.๔๔');
  expect(po.body).toContain('หนึ่งพันห้าร้อยยี่สิบบาทถ้วน');
  expect(po.body).toContain('กล่องพลาสติก');expect(po.body).toContain('ตลับเมตร');
  expect(mapped.find(item=>item.docId==='11.1')!.draft.signer).toBe(input.inspectors[0].fullName);
  expect(mapped.find(item=>item.docId==='11.2')!.draft.signer).toBe(input.inspectors[0].fullName);
  expect(mapped.find(item=>item.docId==='11.2')!.draft.position).toBe(`${input.inspectors[0].position}\nผู้ตรวจรับพัสดุ`);
  for(const id of ['6.2','8','9'] as const){
    const d=mapped.find(item=>item.docId===id)!.draft;
    expect(d.signer,id).toBe(input.signatories.mayor.fullName);
    expect(d.position,id).toContain(input.signatories.mayor.position);
    expect(d.position,id).toContain(input.signatories.mayor.actingLine);
    expect(d.position,id).toContain(input.signatories.mayor.actingTarget);
  }
  expect(mapped.find(item=>item.docId==='11.3')!.draft.signer).toBe(input.inspectors[0].fullName);
  expect(mapped.find(item=>item.docId==='11.3')!.draft.position).toBe(`${input.inspectors[0].position}\nผู้ตรวจรับพัสดุ`);
  input.vendor.isVatRegistered=false;
  expect(mapProcurementCaseToDrafts(input,defaultAgency).find(item=>item.docId==='10')!.draft.body).not.toContain('ภาษีมูลค่าเพิ่ม ๗%');
});

it('assigns the four dedicated layouts and resolves every body and form value to Thai numerals',()=>{
  const input=templateFixture();input.items[0].description='วัสดุ A4 รุ่น X120 ขนาด 120 ลิตร';
  const mapped=mapProcurementCaseToDrafts(input,defaultAgency);
  for(const [id,layout] of Object.entries({'4.1':'procurement-tor','10':'procurement-po','11.2':'procurement-inspection','11.3':'procurement-photos'})){
    const draft=mapped.find(item=>item.docId===id)!.draft;
    expect(draft.layout).toBe(layout);expect(draft.procurementForm).toBeDefined();
    expect(JSON.stringify(draft.procurementForm)).not.toMatch(/[0-9]/);
  }
  for(const {draft} of mapped)expect(draft.body).not.toMatch(/[0-9]/);
  const po=mapped.find(item=>item.docId==='10')!.draft;
  expect(po.procurementForm!.metadataColumns).toHaveLength(2);
  expect(po.procurementForm!.signatureDates).toHaveLength(2);
  expect(po.body).toContain('๑,๔๒๐.๕๖');expect(po.body).toContain('๙๙.๔๔');
  const tor=mapped.find(item=>item.docId==='4.1')!.draft;
  for(const n of ['๑','๒','๓','๔','๕','๖','๗','๘','๙'])expect(tor.body).toContain(`## ${n}.`);
});

it('upgrades an old generic linked form only on explicit Sync and preserves protected arrays',()=>{
  const generated=mapProcurementCaseToDrafts(templateFixture(),defaultAgency).find(item=>item.docId==='10')!.draft;
  const old={...generated,layout:'standard' as const,procurementForm:undefined};
  const result=syncProcurementDraft(old,generated);
  expect(result.layout).toBe('procurement-po');expect(result.procurementForm).toEqual(generated.procurementForm);
  for(const key of ['floatingItems','appendixImages','attachmentFiles'] as const)expect(result[key]).toEqual(old[key]);
});

it('does not invent dates or print the announcement registry number',()=>{
  const input=templateFixture();input.docs.doc13_disbursement={};input.docs.doc8_winnerAnnouncement.registryLogNo='999991';
  const mapped=mapProcurementCaseToDrafts(input,defaultAgency);
  expect(mapped.find(item=>item.docId==='13')!.draft.date).toBe('');
  expect(JSON.stringify(mapped.find(item=>item.docId==='8')!.draft)).not.toContain('999991');
  const doc8=mapped.find(item=>item.docId==='8')!.draft;
  expect(doc8.headerSubtitle).toBe(`ของ${defaultAgency.divisionName} ${defaultAgency.municipalityName} โดยวิธีเฉพาะเจาะจง`);
  expect(doc8.procurementForm).toBeUndefined();
  expect(doc8.body).not.toContain(`ของ${defaultAgency.divisionName} ${defaultAgency.municipalityName} โดยวิธีเฉพาะเจาะจง`);
  expect(doc8.signer).toBe(input.signatories.mayor.fullName);
  expect(doc8.position).toContain(input.signatories.mayor.position);
  const doc62=mapped.find(item=>item.docId==='6.2')!.draft;
  expect(doc62.headerSubtitle.split('\n')).toEqual([
    expect.stringMatching(/^สำหรับการซื้อ.+จำนวน .+ รายการ$/),
    `ของ${defaultAgency.divisionName} ${defaultAgency.municipalityName} โดยวิธีเฉพาะเจาะจง`,
  ]);
  expect(doc62.procurementForm).toBeUndefined();
  expect(doc62.body.startsWith('ด้วย ')).toBe(true);
  expect(doc62.signer).toBe(input.signatories.mayor.fullName);
  expect(doc62.position).toContain(input.signatories.mayor.position);
  const synced62=syncProcurementDraft({...doc62,headerSubtitle:'',signer:'',position:'',body:`${doc62.headerSubtitle}\n${doc62.body}`},doc62);
  expect(synced62.headerSubtitle).toBe(doc62.headerSubtitle);
  expect(synced62.signer).toBe(input.signatories.mayor.fullName);
  expect(synced62.position).toBe(doc62.position);
});

it('Sync changes only generated content, preserves editor data and metadata, and resets review when content changes',()=>{
  const input=templateFixture(),original=mapProcurementCaseToDrafts(input,defaultAgency)[0].draft;
  const current={...original,id:randomUUID(),version:17,status:'reviewed' as const,copyMark:'สำเนาคู่ฉบับ' as const,
    floatingItems:[{kind:'text' as const,id:randomUUID(),page:2,xMm:37,yMm:192,widthMm:60,fontPt:16,bold:true,text:'ตำแหน่งลายเซ็นที่จัดไว้'}],
    appendixImages:[{id:randomUUID(),name:'ภาพ.jpg',mime:'image/jpeg' as const,bytes:100,width:200,height:150,caption:'ภาพเดิม',widthMm:150}],
    attachmentFiles:[{id:randomUUID(),name:'ฎีกา.pdf',description:'ฎีกา',showNameInDocument:true,pages:2,bytes:120,quantity:1,unit:'ชุด' as const,originalAvailable:false}],
    appendixPages:[{id:randomUUID(),title:'หมายเหตุที่ทำเพิ่ม',body:'ห้ามลบ'}],reference:'อ้างถึงที่ผู้ใช้กรอกเอง'};
  const snapshot=structuredClone(current);
  input.items[0].unitPrice=700;input.purposeText='เหตุผลที่ปรับจากข้อมูลกลาง';input.docs.doc1_approvePrinciple.runningNo='2000';input.signatories.procurementOfficer.fullName='นายผู้เสนอใหม่';
  const generated=mapProcurementCaseToDrafts(input,defaultAgency)[0].draft,result=syncProcurementDraft(current,generated);
  expect(result.number).toContain('/2000');expect(result.body).toContain('เหตุผลที่ปรับจากข้อมูลกลาง');expect(result.signer).toBe('นายผู้เสนอใหม่');expect(result.status).toBe('draft');
  expect(mapProcurementCaseToDrafts(input,defaultAgency).find(item=>item.docId==='10')!.draft.body).toContain('๑,๗๔๐.๐๐');
  for(const key of ['floatingItems','appendixImages','attachmentFiles','appendixPages','copyMark','reference','id','version'] as const)expect(result[key]).toEqual(current[key]);
  expect(current).toEqual(snapshot);expect(result.floatingItems).not.toBe(current.floatingItems);
  expect(syncProcurementDraft({...original,status:'reviewed'},original).status).toBe('reviewed');
});

it('maps hire terminology and committee members into editable Core content',()=>{
  const input=templateFixture();input.procurementType='HIRE';input.inspectorMode='COMMITTEE_3';
  input.inspectors=Array.from({length:3},(_,i)=>({fullName:`กรรมการ ${i+1}`,position:'เจ้าหน้าที่',role:i===0?'CHAIRPERSON':'MEMBER'}));
  const mapped=mapProcurementCaseToDrafts(input,defaultAgency),po=mapped.find(item=>item.docId==='10')!.draft;
  expect(po.subject).toBe('ใบสั่งจ้าง');expect(po.body).toContain('๐.๑๐');expect(po.body).toContain('รวมมูลค่างานจ้าง');
  const doc1=mapped.find(item=>item.docId==='1')!.draft,doc7=mapped.find(item=>item.docId==='7')!.draft,doc112=mapped.find(item=>item.docId==='11.2')!.draft;
  expect(doc1.subject).toBe('ขออนุมัติจัดจ้างตามระเบียบพัสดุ');expect(doc1.body).toContain('จัดจ้างกรณีวิธีเฉพาะเจาะจง');
  expect(doc7.subject).toBe('รายงานผลการพิจารณาและขออนุมัติสั่งจ้าง');expect(doc7.body).toContain('รวมมูลค่างานจ้าง');
  expect(doc112.subject).toBe('ใบตรวจรับการจัดจ้าง');
  expect(doc112.signer).toBe('กรรมการ ๑');expect(doc112.position).toBe('เจ้าหน้าที่\nประธานกรรมการ');
  expect(doc112.proposers).toEqual([{name:'กรรมการ ๒',position:'เจ้าหน้าที่\nกรรมการ'},{name:'กรรมการ ๓',position:'เจ้าหน้าที่\nกรรมการ'}]);

  const buyCase=newCase(emptyMaster(),'BUY'),hireCase=newCase(emptyMaster(),'HIRE');
  expect(buyCase.caseInput.procurementType).toBe('BUY');expect(buyCase.caseInput.penaltyRatePercent).toBe(0.2);expect(buyCase.caseInput.budgetLine.categoryGroup).toBe('ค่าวัสดุ');expect(buyCase.caseInput.items[0].unit).toBe('ชิ้น');
  expect(hireCase.caseInput.procurementType).toBe('HIRE');expect(hireCase.caseInput.penaltyRatePercent).toBe(0.1);expect(hireCase.caseInput.budgetLine.categoryGroup).toBe('ค่าใช้สอย');expect(hireCase.caseInput.items[0].unit).toBe('งาน');
  const hireSample=sampleHireCase();
  expect(hireSample.caseInput.procurementType).toBe('HIRE');
  expect(mapProcurementCaseToDrafts(hireSample.caseInput as unknown as Parameters<typeof mapProcurementCaseToDrafts>[0],hireSample.agency)).toHaveLength(15);
});

it('supports explicit INLINE and ATTACHED itemDisplayMode choices for Doc 6.1',()=>{
  const manyInline=templateFixture(22890);manyInline.itemDisplayMode='INLINE';
  const doc61Inline=mapProcurementCaseToDrafts(manyInline,defaultAgency).find(item=>item.docId==='6.1')!.draft;
  expect(doc61Inline.body).not.toContain('รายละเอียดตามที่แนบ');
  expect(doc61Inline.body).not.toContain('เอกสารแนบท้าย');
  expect(doc61Inline.body).toContain('๑. ');expect(doc61Inline.body).toContain('๗. ');

  const shortAttached=templateFixture(1520);shortAttached.itemDisplayMode='ATTACHED';
  const doc61Attached=mapProcurementCaseToDrafts(shortAttached,defaultAgency).find(item=>item.docId==='6.1')!.draft;
  expect(doc61Attached.body).toContain('รายละเอียดตามที่แนบ');
  expect(doc61Attached.body).toContain('เอกสารแนบท้าย');
});

it('Core rendering leaves extra signatures to text boxes and escapes literal table pipes safely',()=>{
  const input=templateFixture();input.items[0].description='วัสดุ A | B <script>alert(1)</script>';
  const po=mapProcurementCaseToDrafts(input,defaultAgency).find(item=>item.docId==='10')!.draft;
  const html=documentHtml(po,{regular:'',bold:'',garuda:'',routingStamp:'',copyMark:''});
  expect(html).toContain('A | B &lt;script&gt;');expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('class="signature"');expect(po.signer).toBe(input.signatories.divisionDirector.fullName);expect(po.proposers).toHaveLength(1);expect(po.proposers[0].name).toBe(input.vendor.contactPersonName);expect(po.opinions).toEqual([]);
});

it('rejects an accidental Sync across source cases or document slots',()=>{
  const first=mapProcurementCaseToDrafts(templateFixture(),defaultAgency),otherInput=templateFixture();otherInput.id='different-case';
  const other=mapProcurementCaseToDrafts(otherInput,defaultAgency);
  expect(()=>syncProcurementDraft(first[0].draft,other[0].draft)).toThrow(/ข้ามงาน/);
  expect(()=>syncProcurementDraft(first[0].draft,first[1].draft)).toThrow(/ข้ามงาน/);
});

it('lets Core paginate photo annexes without importing repeated IR continuation headings into the body',()=>{
  const input=templateFixture();
  const body=mapProcurementCaseToDrafts(input,defaultAgency).find(item=>item.docId==='11.3')!.draft.body;
  input.attachments.photoPaths=Array.from({length:5},(_,i)=>`photo-${i}`);
  const photos=mapProcurementCaseToDrafts(input,defaultAgency).find(item=>item.docId==='11.3')!.draft;
  expect(photos.body).toBe(body);
  expect(photos.body).not.toContain('(ต่อ)');
  expect(photos.body.match(/ขอรับรองว่าเป็นเอกสารที่ถูกต้อง/g)).toHaveLength(1);
});

it('Sync refreshes the generated photo heading while preserving the image array and manually added annex titles elsewhere',()=>{
  const input=templateFixture(),before=mapProcurementCaseToDrafts(input,defaultAgency);
  const photo=before.find(item=>item.docId==='11.3')!.draft;
  const images=[{id:randomUUID(),name:'ภาพ.jpg',mime:'image/jpeg' as const,bytes:100,width:200,height:150,caption:'คำบรรยายที่ผู้ใช้แก้เอง',widthMm:150}];
  input.projectTitleShort='งานใหม่จากข้อมูลกลาง';input.attachments.photoCaptionOverride='หัวภาพรวมใหม่';
  const generated=mapProcurementCaseToDrafts(input,defaultAgency);
  const synced=syncProcurementDraft({...photo,status:'reviewed',appendixImages:images},generated.find(item=>item.docId==='11.3')!.draft);
  expect(synced.appendixTitle).toContain('หัวภาพรวมใหม่');expect(synced.appendixImages).toEqual(images);
  expect(synced.status).toBe('draft');
  expect(syncProcurementDraft({...before[0].draft,appendixTitle:'หัวภาคผนวกทำเพิ่ม'},generated[0].draft).appendixTitle).toBe('หัวภาคผนวกทำเพิ่ม');
});
