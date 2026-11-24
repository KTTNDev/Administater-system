import { expect, it } from 'vitest';
import {
  BUDGET_CATEGORIES,
  BUDGET_PLANS,
  categoryOptionGroups,
  findFundForCategory,
  planOptionGroups,
  shouldResetTypeForCategory,
  shouldResetWorkForPlan,
  typeOptionGroups,
  workOptionGroups,
} from '../src/lib/budget-taxonomy';

it('provides the full official DLA ว 1095 plans, works, categories and expenditure types', () => {
  expect(BUDGET_PLANS.length).toBe(12);
  expect(BUDGET_CATEGORIES.length).toBe(13);

  const planGroups = planOptionGroups();
  expect(planGroups.map(g => g.group)).toEqual([
    'ด้านบริหารทั่วไป',
    'ด้านบริการชุมชนและสังคม',
    'ด้านเศรษฐกิจ',
    'ด้านการดำเนินงานอื่น',
  ]);
  expect(planGroups.flatMap(g => g.options)).toContain('แผนงานสังคมสงเคราะห์');
  expect(planGroups.flatMap(g => g.options)).toContain('แผนงานบริหารงานทั่วไป');

  const socialWorks = workOptionGroups('แผนงานสังคมสงเคราะห์');
  expect(socialWorks[0].options).toEqual([
    'งานบริหารทั่วไปเกี่ยวกับสังคมสงเคราะห์',
    'งานสวัสดิการสังคมและสังคมสงเคราะห์',
  ]);

  const materialTypes = typeOptionGroups('ค่าวัสดุ');
  expect(materialTypes[0].options).toHaveLength(20);
  expect(materialTypes[0].options).toContain('วัสดุสำนักงาน');
  expect(materialTypes[0].options).toContain('วัสดุคอมพิวเตอร์');

  const equipmentTypes = typeOptionGroups('ค่าครุภัณฑ์');
  expect(equipmentTypes[0].options).toHaveLength(17);
  expect(equipmentTypes[0].options).toContain('ครุภัณฑ์สำนักงาน');
  expect(equipmentTypes[0].options).toContain('ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์');
});

it('supports stripped prefixes for budget transfers and infers fund from category', () => {
  expect(planOptionGroups(true).flatMap(g => g.options)).toContain('สังคมสงเคราะห์');
  expect(workOptionGroups('สังคมสงเคราะห์', true)[0].options).toEqual([
    'บริหารทั่วไปเกี่ยวกับสังคมสงเคราะห์',
    'สวัสดิการสังคมและสังคมสงเคราะห์',
  ]);
  expect(findFundForCategory('ค่าวัสดุ')).toBe('งบดำเนินงาน');
  expect(findFundForCategory('ค่าครุภัณฑ์')).toBe('งบลงทุน');
  expect(categoryOptionGroups('งบลงทุน')[0].group).toBe('งบลงทุน');
});

it('resets mismatched standard children on parent change while preserving custom entries', () => {
  expect(shouldResetWorkForPlan('แผนงานสังคมสงเคราะห์', 'งานไฟฟ้าถนน')).toBe(true);
  expect(shouldResetWorkForPlan('แผนงานสังคมสงเคราะห์', 'งานบริหารทั่วไปเกี่ยวกับสังคมสงเคราะห์')).toBe(false);
  expect(shouldResetWorkForPlan('แผนงานสังคมสงเคราะห์', 'งานพิเศษที่เทศบาลตั้งเอง')).toBe(false);

  expect(shouldResetTypeForCategory('ค่าครุภัณฑ์', 'วัสดุสำนักงาน')).toBe(true);
  expect(shouldResetTypeForCategory('ค่าครุภัณฑ์', 'ครุภัณฑ์สำนักงาน')).toBe(false);
  expect(shouldResetTypeForCategory('ค่าครุภัณฑ์', 'ประเภทที่ตั้งชื่อเฉพาะเอง')).toBe(false);
});
