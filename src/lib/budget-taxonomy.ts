/**
 * โครงสร้างการจำแนกแผนงาน งาน งบ หมวด และประเภทรายจ่ายขององค์กรปกครองส่วนท้องถิ่น (อปท.)
 * อ้างอิง: หนังสือกระทรวงมหาดไทย ที่ มท 0808.2/ว 1095 ลงวันที่ 28 พฤษภาคม 2564
 * เรื่อง รูปแบบและการจำแนกประเภทรายรับ – รายจ่าย งบประมาณรายจ่ายประจำปีขององค์กรปกครองส่วนท้องถิ่น
 */

export const BUDGET_TAXONOMY_REFERENCE = 'ตามหนังสือ มท 0808.2/ว 1095 (ลว. 28 พ.ค. 2564)';

export interface BudgetPlanDefinition {
  sector: string;
  plan: string;
  works: readonly string[];
}

export interface BudgetCategoryDefinition {
  fund: string;
  category: string;
  types: readonly string[];
}

export interface TaxonomyOptionGroup {
  group: string;
  options: string[];
}

export const BUDGET_PLANS: readonly BudgetPlanDefinition[] = [
  {
    sector: 'ด้านบริหารทั่วไป',
    plan: 'แผนงานบริหารงานทั่วไป',
    works: [
      'งานบริหารทั่วไป',
      'งานบริหารงานคลัง',
      'งานวางแผนสถิติและวิชาการ',
      'งานควบคุมภายในและการตรวจสอบภายใน',
      'งานกิจการสภา',
    ],
  },
  {
    sector: 'ด้านบริหารทั่วไป',
    plan: 'แผนงานการรักษาความสงบภายใน',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับการรักษาความสงบภายใน',
      'งานป้องกันและบรรเทาสาธารณภัย',
      'งานเทศกิจ',
      'งานจราจร',
    ],
  },
  {
    sector: 'ด้านบริการชุมชนและสังคม',
    plan: 'แผนงานการศึกษา',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับการศึกษา',
      'งานระดับก่อนวัยเรียนและประถมศึกษา',
      'งานระดับมัธยมศึกษา',
      'งานส่งเสริมและสนับสนุนการศึกษา',
    ],
  },
  {
    sector: 'ด้านบริการชุมชนและสังคม',
    plan: 'แผนงานสาธารณสุข',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับสาธารณสุข',
      'งานบริการสาธารณสุขและงานสาธารณสุขอื่น',
      'งานโรงพยาบาล',
    ],
  },
  {
    sector: 'ด้านบริการชุมชนและสังคม',
    plan: 'แผนงานสังคมสงเคราะห์',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับสังคมสงเคราะห์',
      'งานสวัสดิการสังคมและสังคมสงเคราะห์',
    ],
  },
  {
    sector: 'ด้านบริการชุมชนและสังคม',
    plan: 'แผนงานเคหะและชุมชน',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับเคหะและชุมชน',
      'งานไฟฟ้าถนน',
      'งานสวนสาธารณะ',
      'งานกำจัดขยะมูลฝอยและสิ่งปฏิกูล',
      'งานบำบัดน้ำเสีย',
      'งานประปา',
    ],
  },
  {
    sector: 'ด้านบริการชุมชนและสังคม',
    plan: 'แผนงานสร้างความเข้มแข็งของชุมชน',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับการสร้างความเข้มแข็งของชุมชน',
      'งานส่งเสริมและสนับสนุนความเข้มแข็งชุมชน',
    ],
  },
  {
    sector: 'ด้านบริการชุมชนและสังคม',
    plan: 'แผนงานการศาสนา วัฒนธรรม และนันทนาการ',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับศาสนา วัฒนธรรม และนันทนาการ',
      'งานศาสนาและวัฒนธรรมท้องถิ่น',
      'งานสนับสนุนศิลปวัฒนธรรม ขนบธรรมเนียม ประเพณีท้องถิ่น',
      'งานกีฬาและนันทนาการ',
    ],
  },
  {
    sector: 'ด้านเศรษฐกิจ',
    plan: 'แผนงานอุตสาหกรรมและการโยธา',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับอุตสาหกรรมและการโยธา',
      'งานก่อสร้าง',
      'งานควบคุมอาคารและผังเมือง',
    ],
  },
  {
    sector: 'ด้านเศรษฐกิจ',
    plan: 'แผนงานการเกษตร',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับกิจการเกษตร',
      'งานส่งเสริมการเกษตร',
      'งานส่งเสริมแหล่งน้ำเกษตร',
    ],
  },
  {
    sector: 'ด้านเศรษฐกิจ',
    plan: 'แผนงานการพาณิชย์',
    works: [
      'งานบริหารทั่วไปเกี่ยวกับการพาณิชย์',
      'งานกิจการประปา',
      'งานกิจการตลาดสด',
      'งานกิจการโรงฆ่าสัตว์',
      'งานกิจการสถานีขนส่ง',
      'งานพาณิชย์อื่น ๆ',
    ],
  },
  {
    sector: 'ด้านการดำเนินงานอื่น',
    plan: 'แผนงานงบกลาง',
    works: ['งานงบกลาง'],
  },
];

export const BUDGET_CATEGORIES: readonly BudgetCategoryDefinition[] = [
  {
    fund: 'งบดำเนินงาน',
    category: 'ค่าวัสดุ',
    types: [
      'วัสดุสำนักงาน',
      'วัสดุไฟฟ้าและวิทยุ',
      'วัสดุงานบ้านงานครัว',
      'วัสดุก่อสร้าง',
      'วัสดุยานพาหนะและขนส่ง',
      'วัสดุเชื้อเพลิงและหล่อลื่น',
      'วัสดุวิทยาศาสตร์หรือการแพทย์',
      'วัสดุการเกษตร',
      'วัสดุโฆษณาและเผยแพร่',
      'วัสดุเครื่องแต่งกาย',
      'วัสดุคอมพิวเตอร์',
      'วัสดุการศึกษา',
      'วัสดุการกีฬา',
      'วัสดุเครื่องดับเพลิง',
      'วัสดุสนามและการฝึก',
      'วัสดุสำรวจ',
      'วัสดุโรงงาน',
      'วัสดุหนังสือ วารสาร และตำรา',
      'วัสดุเครื่องดนตรีและนาฏศิลป์',
      'วัสดุอื่น',
    ],
  },
  {
    fund: 'งบดำเนินงาน',
    category: 'ค่าใช้สอย',
    types: [
      'รายจ่ายเพื่อให้ได้มาซึ่งบริการ',
      'รายจ่ายเกี่ยวกับการรับรองและพิธีการ',
      'รายจ่ายเกี่ยวเนื่องกับการปฏิบัติราชการที่ไม่เข้าลักษณะรายจ่ายงบรายจ่ายอื่น ๆ',
      'ค่าบำรุงรักษาและซ่อมแซม',
    ],
  },
  {
    fund: 'งบดำเนินงาน',
    category: 'ค่าตอบแทน',
    types: [
      'ค่าตอบแทนผู้ปฏิบัติราชการอันเป็นประโยชน์แก่องค์กรปกครองส่วนท้องถิ่น',
      'ค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ',
      'ค่าเบี้ยประชุม',
      'ค่าเช่าบ้าน',
      'เงินช่วยเหลือการศึกษาบุตร',
      'เงินช่วยเหลือค่ารักษาพยาบาล',
      'เงินประโยชน์ตอบแทนอื่นเป็นกรณีพิเศษ (โบนัส)',
      'ค่าตอบแทนอื่น',
    ],
  },
  {
    fund: 'งบดำเนินงาน',
    category: 'ค่าสาธารณูปโภค',
    types: [
      'ค่าไฟฟ้า',
      'ค่าน้ำประปา',
      'ค่าโทรศัพท์',
      'ค่าบริการไปรษณีย์',
      'ค่าบริการสื่อสารและโทรคมนาคม',
    ],
  },
  {
    fund: 'งบลงทุน',
    category: 'ค่าครุภัณฑ์',
    types: [
      'ครุภัณฑ์สำนักงาน',
      'ครุภัณฑ์ยานพาหนะและขนส่ง',
      'ครุภัณฑ์ไฟฟ้าและวิทยุ',
      'ครุภัณฑ์โฆษณาและเผยแพร่',
      'ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์',
      'ครุภัณฑ์งานบ้านงานครัว',
      'ครุภัณฑ์การเกษตร',
      'ครุภัณฑ์วิทยาศาสตร์หรือการแพทย์',
      'ครุภัณฑ์โรงงาน',
      'ครุภัณฑ์สำรวจ',
      'ครุภัณฑ์ก่อสร้าง',
      'ครุภัณฑ์การศึกษา',
      'ครุภัณฑ์กีฬา',
      'ครุภัณฑ์ดนตรีและนาฏศิลป์',
      'ครุภัณฑ์ดับเพลิง',
      'ครุภัณฑ์อาวุธ',
      'ครุภัณฑ์อื่น',
    ],
  },
  {
    fund: 'งบลงทุน',
    category: 'ค่าที่ดินและสิ่งก่อสร้าง',
    types: [
      'ค่าที่ดิน',
      'ค่าก่อสร้างอาคาร',
      'ค่าก่อสร้างสิ่งสาธารณูปโภค',
      'ค่าก่อสร้างสิ่งก่อสร้างอื่น',
      'ค่าบำรุงรักษาและปรับปรุงที่ดินและสิ่งก่อสร้าง',
      'ค่าออกแบบ ค่าควบคุมงานที่จ่ายให้แก่เอกชน นิติบุคคล หรือบุคคลภายนอก',
      'ค่าจัดทำแผนที่ภาษีและทะเบียนทรัพย์สิน',
    ],
  },
  {
    fund: 'งบเงินอุดหนุน',
    category: 'เงินอุดหนุน',
    types: [
      'เงินอุดหนุนส่วนราชการ',
      'เงินอุดหนุนองค์กรปกครองส่วนท้องถิ่น',
      'เงินอุดหนุนรัฐวิสาหกิจ',
      'เงินอุดหนุนองค์กรประชาชน',
      'เงินอุดหนุนกิจการที่เป็นสาธารณประโยชน์',
      'เงินอุดหนุนองค์กรศาสนา',
    ],
  },
  {
    fund: 'งบรายจ่ายอื่น',
    category: 'รายจ่ายอื่น',
    types: [
      'รายจ่ายตามข้อผูกพัน',
      'รายจ่ายอื่นตามกฎหมายหรือระเบียบกำหนด',
    ],
  },
  {
    fund: 'งบบุคลากร',
    category: 'เงินเดือน (ฝ่ายการเมือง)',
    types: [
      'เงินเดือนนายก/รองนายก',
      'ค่าตอบแทนประจำตำแหน่งนายก/รองนายก',
      'ค่าตอบแทนพิเศษนายก/รองนายก',
      'ค่าตอบแทนรายเดือนเลขานุการ/ที่ปรึกษานายก',
      'ค่าตอบแทนประธานสภา/รองประธานสภา/สมาชิกสภา',
    ],
  },
  {
    fund: 'งบบุคลากร',
    category: 'เงินเดือน (ฝ่ายประจำ)',
    types: [
      'เงินเดือนข้าราชการ หรือพนักงานส่วนท้องถิ่น',
      'เงินเพิ่มต่าง ๆ ของข้าราชการ หรือพนักงานส่วนท้องถิ่น',
      'เงินประจำตำแหน่ง',
      'เงินวิทยฐานะ',
    ],
  },
  {
    fund: 'งบบุคลากร',
    category: 'ค่าจ้างประจำ',
    types: [
      'ค่าจ้างลูกจ้างประจำ',
      'เงินเพิ่มต่าง ๆ ของลูกจ้างประจำ',
    ],
  },
  {
    fund: 'งบบุคลากร',
    category: 'ค่าตอบแทนพนักงานจ้าง',
    types: [
      'ค่าตอบแทนพนักงานจ้างตามภารกิจ',
      'ค่าตอบแทนพนักงานจ้างทั่วไป',
      'เงินเพิ่มต่าง ๆ ของพนักงานจ้าง',
    ],
  },
  {
    fund: 'งบกลาง',
    category: 'งบกลาง',
    types: [
      'เงินสำรองจ่าย',
      'เงินสมทบกองทุนบำเหน็จบำนาญข้าราชการส่วนท้องถิ่น (ก.บ.ท.)',
      'เงินสมทบกองทุนประกันสังคม',
      'เงินสมทบกองทุนเงินทดแทน',
      'เบี้ยยังชีพผู้สูงอายุ',
      'เบี้ยยังชีพความพิการ',
      'เบี้ยยังชีพผู้ป่วยเอดส์',
      'รายจ่ายตามข้อผูกพัน',
      'เงินช่วยเหลือค่าทำศพ',
    ],
  },
];

export const BUDGET_FUNDS: readonly string[] = [
  'งบดำเนินงาน',
  'งบลงทุน',
  'งบเงินอุดหนุน',
  'งบรายจ่ายอื่น',
  'งบบุคลากร',
  'งบกลาง',
];

const stripPlan = (value: string) => value.replace(/^แผนงาน/, '').trim();
const stripWork = (value: string) => value.replace(/^งาน/, '').trim();
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

export function findPlanDefinition(planValue: string): BudgetPlanDefinition | undefined {
  const key = stripPlan(normalize(planValue));
  if (!key) return undefined;
  return BUDGET_PLANS.find(item => stripPlan(item.plan) === key || item.plan === normalize(planValue));
}

export function findCategoryDefinition(categoryValue: string): BudgetCategoryDefinition | undefined {
  const key = normalize(categoryValue).replace(/^หมวด/, '').trim();
  if (!key) return undefined;
  return BUDGET_CATEGORIES.find(item => item.category === key);
}

export function findFundForCategory(categoryValue: string): string {
  return findCategoryDefinition(categoryValue)?.fund ?? '';
}

export function planOptionGroups(stripPrefix = false): TaxonomyOptionGroup[] {
  const groups = new Map<string, string[]>();
  for (const item of BUDGET_PLANS) {
    const list = groups.get(item.sector) ?? [];
    list.push(stripPrefix ? stripPlan(item.plan) : item.plan);
    groups.set(item.sector, list);
  }
  return Array.from(groups, ([group, options]) => ({ group, options }));
}

export function workOptionGroups(planValue: string, stripPrefix = false): TaxonomyOptionGroup[] {
  const format = (work: string) => (stripPrefix ? stripWork(work) : work);
  const selected = findPlanDefinition(planValue);
  if (!selected) {
    return BUDGET_PLANS.map(item => ({
      group: item.plan,
      options: item.works.map(format),
    }));
  }
  const primary: TaxonomyOptionGroup = {
    group: `${selected.plan} (แนะนำตามแผนงานที่เลือก)`,
    options: selected.works.map(format),
  };
  const primarySet = new Set(primary.options);
  const others = BUDGET_PLANS.filter(item => item.plan !== selected.plan)
    .map(item => ({
      group: item.plan,
      options: item.works.map(format).filter(work => !primarySet.has(work)),
    }))
    .filter(item => item.options.length > 0);
  return [primary, ...others];
}

export function fundOptionGroups(): TaxonomyOptionGroup[] {
  return [{ group: 'งบรายจ่ายตาม ว 1095', options: [...BUDGET_FUNDS] }];
}

export function categoryOptionGroups(fundValue = ''): TaxonomyOptionGroup[] {
  const selectedFund = normalize(fundValue);
  const groups = new Map<string, string[]>();
  for (const item of BUDGET_CATEGORIES) {
    const list = groups.get(item.fund) ?? [];
    list.push(item.category);
    groups.set(item.fund, list);
  }
  const ordered = Array.from(groups, ([group, options]) => ({ group, options }));
  if (!selectedFund || !groups.has(selectedFund)) return ordered;
  return [
    ...ordered.filter(item => item.group === selectedFund),
    ...ordered.filter(item => item.group !== selectedFund),
  ];
}

export function typeOptionGroups(categoryValue: string): TaxonomyOptionGroup[] {
  const selected = findCategoryDefinition(categoryValue);
  if (!selected) {
    return BUDGET_CATEGORIES.map(item => ({
      group: `${item.category} (${item.fund})`,
      options: [...item.types],
    }));
  }
  return [
    {
      group: `ประเภทในหมวด${selected.category} (${selected.types.length} รายการ)`,
      options: [...selected.types],
    },
    ...BUDGET_CATEGORIES.filter(item => item.category !== selected.category).map(item => ({
      group: `หมวด${item.category} (${item.fund})`,
      options: [...item.types],
    })),
  ];
}

/** True only when `workValue` is a standard work belonging to a different plan than `nextPlan`. */
export function shouldResetWorkForPlan(nextPlan: string, currentWork: string, stripPrefix = false): boolean {
  const target = findPlanDefinition(nextPlan);
  const cleanWork = normalize(currentWork);
  if (!target || !cleanWork) return false;
  const format = (work: string) => (stripPrefix ? stripWork(work) : work);
  if (target.works.some(work => format(work) === cleanWork || stripWork(work) === stripWork(cleanWork))) return false;
  return BUDGET_PLANS.some(item => item.works.some(work => format(work) === cleanWork || stripWork(work) === stripWork(cleanWork)));
}

/** True only when `typeValue` is a standard type belonging to a different category than `nextCategory`. */
export function shouldResetTypeForCategory(nextCategory: string, currentType: string): boolean {
  const target = findCategoryDefinition(nextCategory);
  const cleanType = normalize(currentType);
  if (!target || !cleanType) return false;
  if (target.types.includes(cleanType)) return false;
  return BUDGET_CATEGORIES.some(item => item.types.includes(cleanType));
}
