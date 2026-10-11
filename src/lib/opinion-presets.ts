export const opinionPresets = [
  { title: "ความเห็นหัวหน้าฝ่ายอำนวยการ", position: "หัวหน้าฝ่ายอำนวยการ" },
  { title: "ความเห็นหัวหน้าฝ่ายปกครอง", position: "หัวหน้าฝ่ายปกครอง" },
  { title: "ความเห็นหัวหน้าฝ่ายบริหารงานทั่วไป", position: "หัวหน้าฝ่ายบริหารงานทั่วไป" },
  { title: "ความเห็นหัวหน้าฝ่ายบริหารงานคลัง", position: "หัวหน้าฝ่ายบริหารงานคลัง" },
  { title: "ความเห็นหัวหน้าฝ่ายการเจ้าหน้าที่", position: "หัวหน้าฝ่ายการเจ้าหน้าที่" },
  { title: "ความเห็นหัวหน้าฝ่ายแผนงานและงบประมาณ", position: "หัวหน้าฝ่ายแผนงานและงบประมาณ" },
  { title: "ความเห็นหัวหน้าฝ่ายการเงินและบัญชี", position: "หัวหน้าฝ่ายการเงินและบัญชี" },
  { title: "ความเห็นหัวหน้าฝ่ายแบบแผนและก่อสร้าง", position: "หัวหน้าฝ่ายแบบแผนและก่อสร้าง" },
  { title: "ความเห็นหัวหน้าฝ่ายสาธารณูปโภค", position: "หัวหน้าฝ่ายสาธารณูปโภค" },
  { title: "ความเห็นหัวหน้าฝ่ายบริหารงานสาธารณสุข", position: "หัวหน้าฝ่ายบริหารงานสาธารณสุข" },
  { title: "ความเห็นหัวหน้าฝ่ายส่งเสริมการศึกษา", position: "หัวหน้าฝ่ายส่งเสริมการศึกษา" },
  { title: "ความเห็นหัวหน้าฝ่ายพัฒนาชุมชน", position: "หัวหน้าฝ่ายพัฒนาชุมชน" },
  { title: "ความเห็นหัวหน้าสำนักปลัด", position: "หัวหน้าสำนักปลัดเทศบาล" },
  { title: "ความเห็นผู้อำนวยการกองคลัง", position: "ผู้อำนวยการกองคลัง" },
  { title: "ความเห็นผู้อำนวยการกองช่าง", position: "ผู้อำนวยการกองช่าง" },
  { title: "ความเห็นผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม", position: "ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม" },
  { title: "ความเห็นผู้อำนวยการกองการศึกษา", position: "ผู้อำนวยการกองการศึกษา" },
  { title: "ความเห็นผู้อำนวยการกองสวัสดิการสังคม", position: "ผู้อำนวยการกองสวัสดิการสังคม" },
  { title: "ความเห็นผู้อำนวยการกองยุทธศาสตร์และงบประมาณ", position: "ผู้อำนวยการกองยุทธศาสตร์และงบประมาณ" },
  { title: "ความเห็นผู้อำนวยการกองการเจ้าหน้าที่", position: "ผู้อำนวยการกองการเจ้าหน้าที่" },
  { title: "ความเห็นหัวหน้าหน่วยตรวจสอบภายใน", position: "หัวหน้าหน่วยตรวจสอบภายใน" },
  { title: "ความเห็นรองปลัดเทศบาล", position: "รองปลัดเทศบาล" },
  { title: "ความเห็นปลัดเทศบาล", position: "ปลัดเทศบาล" },
  { title: "ความเห็นรองนายกเทศมนตรี", position: "รองนายกเทศมนตรี" },
  { title: "ความเห็นนายกเทศมนตรี", position: "นายกเทศมนตรี" },
] as const;

export const opinionPositions = [...new Set(opinionPresets.map(item => item.position))];

export function officePosition(position: string, organization: string) {
  const suffix = organization.replace(/^เทศบาล/, "");
  const localRoles = ["นายกเทศมนตรี", "รองนายกเทศมนตรี", "ปลัดเทศบาล", "รองปลัดเทศบาล", "หัวหน้าสำนักปลัดเทศบาล"];
  return suffix && organization.startsWith("เทศบาล") && localRoles.includes(position)
    ? `${position}${suffix}` : position;
}

export function positionForOpinion(title: string, organization: string) {
  const preset = opinionPresets.find(item => item.title === title);
  return preset ? officePosition(preset.position, organization) : undefined;
}

export function positionAfterTitleChange(oldTitle: string, oldPosition: string, newTitle: string, organization: string) {
  const oldPreset = positionForOpinion(oldTitle, organization);
  const oldBasePosition = opinionPresets.find(item => item.title === oldTitle)?.position;
  return !oldPosition.trim() || oldPosition === oldPreset || oldPosition === oldBasePosition || oldPosition === oldTitle.replace(/^ความเห็น/, "")
    ? positionForOpinion(newTitle, organization) || ""
    : oldPosition;
}
