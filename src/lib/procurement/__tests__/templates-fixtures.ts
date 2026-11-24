import {fixture} from './fixtures';
import {computeProcurementCase, defaultAgency, buildDocumentModels, renderDocumentHtml} from '../index';
import type {ProcurementCaseInput, RenderedDocumentSpec, TemplateOptions} from '../index';

export function templateFixture(total = 1520): ProcurementCaseInput {
  const input = fixture(total);
  input.signatories.procurementOfficer = {id: 'officer', fullName: 'นายกิตตินันท์ พลรบ', position: 'เจ้าพนักงานธุรการปฏิบัติงาน'};
  input.signatories.divisionDirector = {id: 'director', fullName: 'นางสาวผู้อำนวยการ ทดสอบ', position: 'ผู้อำนวยการกองสวัสดิการสังคม'};
  input.signatories.municipalClerk = {id: 'clerk', fullName: 'นายปลัด ทดสอบ', position: 'รองปลัดเทศบาล', actingLine: 'รักษาราชการแทน', actingTarget: 'ปลัดเทศบาลตำบลฉลอง'};
  input.signatories.mayor = {id: 'mayor', fullName: 'นายผู้อนุมัติ ทดสอบ', position: 'รองนายกเทศมนตรี', actingLine: 'ปฏิบัติราชการแทน', actingTarget: 'นายกเทศมนตรีตำบลฉลอง'};
  input.inspectors = [{fullName: 'นางสาวศิริวรรณ ไทยมิตรชอบ', position: 'นักพัฒนาชุมชนชำนาญการ', role: 'INSPECTOR'}];
  input.vendor.shopName = 'ร้านดินสอสี';
  input.vendor.contactPersonName = 'นายณัฐวิทย์ แซ่ลิ่ม';
  input.vendor.address = '๙๙ หมู่ 4 ตำบลฉลอง อำเภอเมืองภูเก็ต จังหวัดภูเก็ต 83130';
  input.items.forEach((item, i) => { item.description = total === 1520 ? ['กล่องพลาสติกมีฝาปิด ขนาด 120 ลิตร', 'ตลับเมตรสายวัดยาว 50 เมตร'][i] : `วัสดุสำนักงานรายการที่ ${i + 1}`; });
  return input;
}
export const modelsFor = (input = templateFixture(), options: TemplateOptions = {}) => buildDocumentModels(computeProcurementCase(input), defaultAgency, options);
export const findDoc = (models: RenderedDocumentSpec[], id: string) => {
  const model = models.find(d => d.docId === id);
  if (!model) throw new Error(`Missing document ${id}`);
  return model;
};
export const visibleText = (model: RenderedDocumentSpec) => renderDocumentHtml(model).replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '');
