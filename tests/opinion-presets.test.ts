import {describe,it,expect} from "vitest";
import {opinionPresets,positionForOpinion,positionAfterTitleChange,officePosition} from "../src/lib/opinion-presets";
const organization="เทศบาลตำบลราไวย์";
describe("opinion title and position presets",()=>{
 it("includes division heads, office heads, directors and municipal executives",()=>{
  for(const title of ["ความเห็นหัวหน้าฝ่ายอำนวยการ","ความเห็นหัวหน้าสำนักปลัด","ความเห็นผู้อำนวยการกองคลัง","ความเห็นผู้อำนวยการกองการเจ้าหน้าที่","ความเห็นรองปลัดเทศบาล","ความเห็นปลัดเทศบาล","ความเห็นรองนายกเทศมนตรี","ความเห็นนายกเทศมนตรี"])
   expect(opinionPresets.some(item=>item.title===title)).toBe(true);
 });
 it("uses the chosen role while keeping organization-specific executive titles",()=>{
  expect(positionForOpinion("ความเห็นหัวหน้าฝ่ายอำนวยการ",organization)).toBe("หัวหน้าฝ่ายอำนวยการ");
  expect(positionForOpinion("ความเห็นนายกเทศมนตรี",organization)).toBe("นายกเทศมนตรีตำบลราไวย์");
  expect(officePosition("หัวหน้าสำนักปลัดเทศบาล",organization)).toBe("หัวหน้าสำนักปลัดเทศบาลตำบลราไวย์");
 });
 it("updates only an automatic position, preserving acting or custom positions",()=>{
  const previous="ความเห็นปลัดเทศบาล",next="ความเห็นหัวหน้าฝ่ายอำนวยการ";
  expect(positionAfterTitleChange(previous,"ปลัดเทศบาลตำบลราไวย์",next,organization)).toBe("หัวหน้าฝ่ายอำนวยการ");
  expect(positionAfterTitleChange(previous,"",next,organization)).toBe("หัวหน้าฝ่ายอำนวยการ");
  expect(positionAfterTitleChange(previous,"ปลัดเทศบาล",next,organization)).toBe("หัวหน้าฝ่ายอำนวยการ");
  expect(positionAfterTitleChange("ความเห็นหัวหน้าสำนักปลัด","หัวหน้าสำนักปลัด",next,organization)).toBe("หัวหน้าฝ่ายอำนวยการ");
  expect(positionAfterTitleChange(previous,"รักษาราชการแทนปลัดเทศบาล",next,organization)).toBe("รักษาราชการแทนปลัดเทศบาล");
  expect(positionAfterTitleChange(previous,"ปลัดเทศบาลตำบลราไวย์","ความเห็นอื่น ๆ",organization)).toBe("");
 });
});
