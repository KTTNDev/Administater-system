import {it,expect} from 'vitest';
import {templates} from '../src/lib/templates';
import {newProcurement,procurementSchema,procurementFileSchema} from '../src/lib/procurement';
import {defaultProcurementTypes,procurementDocumentNames,procurementTypeName} from '../src/lib/procurement-document-types';
it('uses the existing thirteen document types and separates workflow codes from document families',()=>{
 expect(templates).toHaveLength(13);const ids=new Set(templates.map(type=>type.id));
 for(const code of Object.keys(procurementDocumentNames))expect(ids.has(defaultProcurementTypes[code as keyof typeof defaultProcurementTypes])).toBe(true);
 expect(defaultProcurementTypes.D06).toBe('order');expect(defaultProcurementTypes.D08).toBe('announcement');expect(defaultProcurementTypes.D01).toBe('internal');expect(defaultProcurementTypes.D07).toBe('internal');expect(defaultProcurementTypes.D09).toBe('other');expect(procurementTypeName('internal')).toContain('บันทึกข้อความ');
});
it('adds compatible defaults to older cases, persists per-case classification, and rejects unknown types',()=>{
 const data=newProcurement();data.title='งานทดสอบ';const {documentTypes:_,...older}=data;
 expect(procurementSchema.parse(older).documentTypes.D06).toBe('order');
 expect(procurementSchema.parse({...data,documentTypes:{...data.documentTypes,D13:'memorandum'}}).documentTypes.D13).toBe('memorandum');
 expect(procurementSchema.safeParse({...data,documentTypes:{...data.documentTypes,D06:'unknown'}}).success).toBe(false);
 const file=procurementFileSchema.parse({code:'D08',origin:'egp',caseVersion:null,documentType:'announcement'});expect(file.documentType).toBe('announcement');
});
