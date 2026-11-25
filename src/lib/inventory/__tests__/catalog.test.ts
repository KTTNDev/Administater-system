import {describe,expect,it} from 'vitest';
import {
  findCategoryByName,
  getMaterialCategory,
  MATERIAL_CATEGORIES,
  mergeSuggestedUnits,
  searchStandardCatalog,
} from '../catalog/standard-units';
import {CategoryCodeSchema} from '../schema';

describe('18-category official material & standard unit catalog', () => {
  it('seeds all 18 official Thai government categories from 01 to 18', () => {
    expect(MATERIAL_CATEGORIES).toHaveLength(18);
    const codes = MATERIAL_CATEGORIES.map(c => c.code);
    expect(codes).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09',
      '10', '11', '12', '13', '14', '15', '16', '17', '18',
    ]);
    for (const category of MATERIAL_CATEGORIES) {
      expect(CategoryCodeSchema.safeParse(category.code).success).toBe(true);
      expect(category.categoryName.length).toBeGreaterThan(2);
      expect(category.items.length).toBeGreaterThanOrEqual(3);
      for (const item of category.items) {
        expect(item.allowedUnits.length).toBeGreaterThan(0);
      }
    }
    expect(CategoryCodeSchema.safeParse('00').success).toBe(false);
    expect(CategoryCodeSchema.safeParse('19').success).toBe(false);
  });

  it('supports Thai and English fuzzy search with optional category filter', () => {
    const postIt = searchStandardCatalog('โพสอิท');
    expect(postIt[0]).toMatchObject({
      categoryCode: '01',
      categoryName: 'วัสดุสำนักงาน',
      itemName: 'กระดาษโน้ต/โพสอิท',
    });
    expect(postIt[0].suggestedUnits).toEqual(['แพค', 'แผง']);

    const postItEn = searchStandardCatalog('post-it');
    expect(postItEn[0].itemName).toBe('กระดาษโน้ต/โพสอิท');

    const a4 = searchStandardCatalog('กระดาษถ่ายเอกสาร A4');
    expect(a4[0].categoryCode).toBe('01');
    expect(a4[0].suggestedUnits).toContain('รีม');

    const flash = searchStandardCatalog('Flash drive', '12');
    expect(flash).toHaveLength(1);
    expect(flash[0]).toMatchObject({categoryCode: '12', suggestedUnits: ['อัน']});

    const ppe = searchStandardCatalog('PPE');
    expect(ppe[0]).toMatchObject({categoryCode: '18', itemName: 'ชุด PPE', suggestedUnits: ['ชุด']});

    const tapeInConstruction = searchStandardCatalog('ตลับเมตร', '04');
    expect(tapeInConstruction[0].categoryCode).toBe('04');
    expect(tapeInConstruction[0].suggestedUnits).toEqual(['อัน', 'ตลับ']);
  });

  it('resolves categories by code/name and merges custom units after standard units', () => {
    expect(getMaterialCategory('12')?.categoryName).toBe('วัสดุคอมพิวเตอร์');
    expect(findCategoryByName('วัสดุสำนักงาน')?.code).toBe('01');
    expect(findCategoryByName('วัสดุดับเพลิง')?.code).toBe('14');

    expect(mergeSuggestedUnits(['แพค', 'รีม'], 'กล่อง')).toEqual(['แพค', 'รีม', 'กล่อง']);
    expect(mergeSuggestedUnits(['แพค', 'แผง'], 'แผง')).toEqual(['แพค', 'แผง']);
  });
});
