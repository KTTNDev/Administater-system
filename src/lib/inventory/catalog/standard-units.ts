import type {CategoryCode} from '../types';

export interface StandardCatalogSeedItem {
  readonly itemName: string;
  readonly allowedUnits: readonly string[];
  readonly keywords?: readonly string[];
}

export interface StandardMaterialCategory {
  readonly code: CategoryCode;
  readonly categoryName: string;
  readonly items: readonly StandardCatalogSeedItem[];
}

export interface CatalogSearchResult {
  categoryCode: CategoryCode;
  categoryName: string;
  itemName: string;
  suggestedUnits: string[];
}

/** Official 18 Thai Government Material Categories (01–18) & Standard Units. */
export const MATERIAL_CATEGORIES: readonly StandardMaterialCategory[] = [
  {
    code: '01',
    categoryName: 'วัสดุสำนักงาน',
    items: [
      {itemName: 'กระดาษ', allowedUnits: ['แพค', 'รีม'], keywords: ['กระดาษถ่ายเอกสาร', 'A4', 'paper']},
      {itemName: 'หมึก', allowedUnits: ['ตลับ', 'ขวด'], keywords: ['หมึกตรายาง', 'หมึกเติม', 'ink']},
      {itemName: 'ดินสอ', allowedUnits: ['แท่ง'], keywords: ['ดินสอดำ', 'pencil']},
      {itemName: 'ปากกา', allowedUnits: ['แท่ง'], keywords: ['ปากกาลูกลื่น', 'ปากกาเคมี', 'ปากกาเน้นข้อความ', 'pen']},
      {itemName: 'ยางลบ', allowedUnits: ['ก้อน'], keywords: ['eraser']},
      {itemName: 'เทปกาว', allowedUnits: ['ม้วน'], keywords: ['สก๊อตเทป', 'เทปใส', 'เทปย่น', 'tape']},
      {itemName: 'ลวดเย็บกระดาษ', allowedUnits: ['กล่อง'], keywords: ['ลูกแม็ก', 'staples']},
      {itemName: 'แฟ้ม', allowedUnits: ['แฟ้ม'], keywords: ['แฟ้มสันกว้าง', 'แฟ้มเสนอเซ็น', 'folder']},
      {itemName: 'กระดาษโน้ต/โพสอิท', allowedUnits: ['แพค', 'แผง'], keywords: ['โพสอิท', 'กระดาษโพสอิท', 'คั่นหน้า', 'post-it', 'postit', 'sticky note']},
      {itemName: 'กล่องพลาสติก', allowedUnits: ['กล่อง', 'ใบ'], keywords: ['กล่องพลาสติกอเนกประสงค์', 'กล่องเก็บเอกสาร', 'กล่องมีฝาปิด', 'box']},
      {itemName: 'ตรายาง', allowedUnits: ['ชิ้น', 'อัน'], keywords: ['stamp']},
    ],
  },
  {
    code: '02',
    categoryName: 'วัสดุไฟฟ้าและวิทยุ',
    items: [
      {itemName: 'ไมโครโฟน', allowedUnits: ['ตัว'], keywords: ['mic', 'microphone']},
      {itemName: 'หลอดไฟฟ้า', allowedUnits: ['หลอด'], keywords: ['หลอดไฟ', 'LED', 'bulb']},
      {itemName: 'สายไฟฟ้า', allowedUnits: ['เมตร'], keywords: ['สายไฟ', 'wire']},
      {itemName: 'ปลั๊กไฟฟ้า', allowedUnits: ['ตัว'], keywords: ['ปลั๊กพ่วง', 'เต้ารับ', 'plug']},
      {itemName: 'เบรกเกอร์', allowedUnits: ['ตัว'], keywords: ['breaker']},
      {itemName: 'ถ่าน/แบตเตอรี่', allowedUnits: ['ก้อน'], keywords: ['ถ่านไฟฉาย', 'AA', 'AAA', 'battery']},
      {itemName: 'สายรัด Cable tie', allowedUnits: ['ถุง'], keywords: ['เคเบิ้ลไทร์', 'cable tie']},
      {itemName: 'หัวแลน', allowedUnits: ['ถุง'], keywords: ['RJ45', 'lan']},
    ],
  },
  {
    code: '03',
    categoryName: 'วัสดุงานบ้านงานครัว',
    items: [
      {itemName: 'ผงซักฟอก', allowedUnits: ['ถุง'], keywords: ['detergent']},
      {itemName: 'สบู่', allowedUnits: ['ก้อน'], keywords: ['soap']},
      {itemName: 'น้ำยาดับกลิ่น/น้ำยาทำความสะอาด', allowedUnits: ['ขวด'], keywords: ['น้ำยาล้างห้องน้ำ', 'น้ำยาถูพื้น', 'น้ำยาล้างจาน']},
      {itemName: 'กระดาษชำระ', allowedUnits: ['ม้วน'], keywords: ['ทิชชู', 'tissue']},
      {itemName: 'ถุงขยะ', allowedUnits: ['แพค'], keywords: ['ถุงดำ', 'trash bag']},
      {itemName: 'ถังขยะ', allowedUnits: ['ถัง'], keywords: ['bin']},
      {itemName: 'ไม้กวาด', allowedUnits: ['ด้าม'], keywords: ['broom']},
      {itemName: 'ไม้ถูพื้น', allowedUnits: ['อัน'], keywords: ['ม็อบ', 'mop']},
      {itemName: 'ฟองน้ำ', allowedUnits: ['ก้อน'], keywords: ['sponge']},
      {itemName: 'น้ำดื่ม', allowedUnits: ['ขวด'], keywords: ['water']},
    ],
  },
  {
    code: '04',
    categoryName: 'วัสดุก่อสร้าง',
    items: [
      {itemName: 'ตลับเมตร', allowedUnits: ['อัน', 'ตลับ'], keywords: ['ตลับเมตรวัดระยะ', 'สายวัด', 'tape measure']},
      {itemName: 'สี', allowedUnits: ['ถัง', 'กระป๋อง'], keywords: ['สีทาบ้าน', 'สีสเปรย์', 'paint']},
      {itemName: 'ปูนซีเมนต์', allowedUnits: ['กระสอบ'], keywords: ['ปูน', 'cement']},
      {itemName: 'ท่อน้ำและอุปกรณ์ประปา', allowedUnits: ['ชิ้น'], keywords: ['ท่อ PVC', 'ข้อต่อ']},
      {itemName: 'ตะปู/สกรู', allowedUnits: ['ตัว', 'กล่อง'], keywords: ['น็อต', 'screw', 'nail']},
      {itemName: 'ก๊อกน้ำ', allowedUnits: ['อัน'], keywords: ['faucet']},
      {itemName: 'ซิลิโคน', allowedUnits: ['หลอด'], keywords: ['silicone']},
    ],
  },
  {
    code: '05',
    categoryName: 'วัสดุยานพาหนะและขนส่ง',
    items: [
      {itemName: 'น้ำมันเบรก', allowedUnits: ['ขวด'], keywords: ['brake fluid']},
      {itemName: 'ใบปัดน้ำฝน', allowedUnits: ['ใบ'], keywords: ['wiper']},
      {itemName: 'ยางรถยนต์', allowedUnits: ['เส้น'], keywords: ['tire']},
      {itemName: 'แบตเตอรี่', allowedUnits: ['ลูก'], keywords: ['แบตเตอรี่รถยนต์', 'car battery']},
      {itemName: 'กรวยจราจร', allowedUnits: ['กรวย', 'อัน'], keywords: ['traffic cone']},
      {itemName: 'เสื้อกั๊กสะท้อนแสง', allowedUnits: ['ตัว'], keywords: ['safety vest']},
    ],
  },
  {
    code: '06',
    categoryName: 'วัสดุเชื้อเพลิงและหล่อลื่น',
    items: [
      {itemName: 'แก๊สหุงต้ม', allowedUnits: ['ถัง'], keywords: ['LPG', 'gas']},
      {itemName: 'น้ำมันดีเซล', allowedUnits: ['ลิตร'], keywords: ['diesel']},
      {itemName: 'น้ำมันเบนซิน/แก๊สโซฮอล์', allowedUnits: ['ลิตร'], keywords: ['gasohol', 'petrol']},
      {itemName: 'น้ำมันเครื่อง', allowedUnits: ['ลิตร'], keywords: ['engine oil']},
      {itemName: 'สเปรย์หล่อลื่น', allowedUnits: ['กระป๋อง'], keywords: ['WD-40', 'lubricant']},
    ],
  },
  {
    code: '07',
    categoryName: 'วัสดุวิทยาศาสตร์',
    items: [
      {itemName: 'สำลีและผ้าพันแผล', allowedUnits: ['แพค'], keywords: ['cotton', 'bandage']},
      {itemName: 'แอลกอฮอล์/เจลแอลกอฮอล์', allowedUnits: ['ขวด'], keywords: ['alcohol', 'sanitizer']},
      {itemName: 'ถุงมือ', allowedUnits: ['คู่'], keywords: ['ถุงมือยาง', 'gloves']},
      {itemName: 'ผ้าปิดปาก/หน้ากาก', allowedUnits: ['อัน', 'กล่อง'], keywords: ['mask']},
      {itemName: 'ชุดตรวจ', allowedUnits: ['ชุด'], keywords: ['ATK', 'test kit']},
    ],
  },
  {
    code: '08',
    categoryName: 'วัสดุการเกษตร',
    items: [
      {itemName: 'ปุ๋ย', allowedUnits: ['ถุง'], keywords: ['fertilizer']},
      {itemName: 'ดิน', allowedUnits: ['ถุง'], keywords: ['ดินปลูก', 'soil']},
      {itemName: 'สายยาง', allowedUnits: ['เส้น'], keywords: ['hose']},
      {itemName: 'กระถาง', allowedUnits: ['ใบ'], keywords: ['pot']},
      {itemName: 'กรรไกรตัดกิ่ง', allowedUnits: ['อัน'], keywords: ['pruner']},
      {itemName: 'รองเท้าบูท', allowedUnits: ['คู่'], keywords: ['boots']},
    ],
  },
  {
    code: '09',
    categoryName: 'วัสดุโฆษณาและเผยแพร่',
    items: [
      {itemName: 'ขาตั้งกล้อง', allowedUnits: ['อัน'], keywords: ['tripod']},
      {itemName: 'ป้ายโรลอัพ/ป้ายโฆษณา', allowedUnits: ['ชุด'], keywords: ['ไวนิล', 'roll up', 'banner']},
      {itemName: 'โทรโข่ง', allowedUnits: ['ตัว'], keywords: ['megaphone']},
      {itemName: 'แบตเตอรี่กล้อง', allowedUnits: ['ก้อน'], keywords: ['camera battery']},
      {itemName: 'กระดาษโปสเตอร์', allowedUnits: ['แผ่น'], keywords: ['poster']},
      {itemName: 'ลำโพงขนาดเล็ก', allowedUnits: ['ตัว'], keywords: ['speaker']},
    ],
  },
  {
    code: '10',
    categoryName: 'วัสดุเครื่องแต่งกาย',
    items: [
      {itemName: 'เครื่องแบบ', allowedUnits: ['ชุด'], keywords: ['uniform']},
      {itemName: 'เสื้อ/กางเกง', allowedUnits: ['ตัว'], keywords: ['shirt', 'pants']},
      {itemName: 'รองเท้า', allowedUnits: ['คู่'], keywords: ['shoes']},
      {itemName: 'หมวก', allowedUnits: ['ใบ'], keywords: ['hat', 'cap']},
      {itemName: 'ป้ายพลาสติกติดหน้าอก', allowedUnits: ['ชิ้น'], keywords: ['ป้ายชื่อ', 'badge']},
      {itemName: 'ชุดไทยธรรม', allowedUnits: ['ชุด'], keywords: ['สังฆทาน']},
    ],
  },
  {
    code: '11',
    categoryName: 'วัสดุกีฬา',
    items: [
      {itemName: 'ลูกฟุตบอล', allowedUnits: ['ลูก'], keywords: ['football', 'soccer']},
      {itemName: 'ลูกเปตอง', allowedUnits: ['ลูก'], keywords: ['petanque']},
      {itemName: 'นกหวีด', allowedUnits: ['อัน'], keywords: ['whistle']},
      {itemName: 'กรวยฝึกซ้อม', allowedUnits: ['อัน', 'ชุด'], keywords: ['training cone']},
      {itemName: 'ตาข่ายกีฬา', allowedUnits: ['ผืน'], keywords: ['net']},
    ],
  },
  {
    code: '12',
    categoryName: 'วัสดุคอมพิวเตอร์',
    items: [
      {itemName: 'ตลับผงหมึกสำหรับเครื่องพิมพ์', allowedUnits: ['กล่อง', 'ตลับ'], keywords: ['toner', 'โทนเนอร์', 'หมึกเลเซอร์']},
      {itemName: 'หมึกเครื่องพิมพ์', allowedUnits: ['ขวด'], keywords: ['หมึกเติมเครื่องพิมพ์', 'inkjet', 'printer ink', 'EPSON', 'Canon', 'Brother']},
      {itemName: 'สายแลน', allowedUnits: ['เส้น', 'กล่อง'], keywords: ['LAN', 'CAT6', 'UTP']},
      {itemName: 'เมาส์', allowedUnits: ['อัน'], keywords: ['mouse']},
      {itemName: 'แป้นพิมพ์', allowedUnits: ['อัน'], keywords: ['คีย์บอร์ด', 'keyboard']},
      {itemName: 'แผ่นรองเมาส์', allowedUnits: ['แผ่น'], keywords: ['mouse pad']},
      {itemName: 'Flash drive', allowedUnits: ['อัน'], keywords: ['แฟลชไดรฟ์', 'USB', 'thumb drive']},
      {itemName: 'SSD', allowedUnits: ['ลูก'], keywords: ['ฮาร์ดดิสก์', 'solid state']},
      {itemName: 'แบตเตอรี่สำรองไฟ', allowedUnits: ['ลูก'], keywords: ['UPS']},
      {itemName: 'USB Hub', allowedUnits: ['ชิ้น'], keywords: ['ฮับ']},
    ],
  },
  {
    code: '13',
    categoryName: 'วัสดุการศึกษา',
    items: [
      {itemName: 'สื่อการเรียนการสอน', allowedUnits: ['ชิ้น'], keywords: ['teaching aid']},
      {itemName: 'หุ่น', allowedUnits: ['ชิ้น'], keywords: ['หุ่นจำลอง', 'model']},
      {itemName: 'รหัสเข้าสอบ/License', allowedUnits: ['สิทธิ์', 'License'], keywords: ['license', 'ซอฟต์แวร์']},
    ],
  },
  {
    code: '14',
    categoryName: 'วัสดุดับเพลิง',
    items: [
      {itemName: 'ถังดับเพลิง', allowedUnits: ['ถัง'], keywords: ['fire extinguisher']},
      {itemName: 'ลูกบอลดับเพลิง', allowedUnits: ['ลูก'], keywords: ['fire ball']},
      {itemName: 'เคมีภัณฑ์ดับเพลิง', allowedUnits: ['ถุง'], keywords: ['สารดับเพลิง']},
    ],
  },
  {
    code: '15',
    categoryName: 'วัสดุสนาม',
    items: [
      {itemName: 'เต็นท์สนาม', allowedUnits: ['หลัง'], keywords: ['เต็นท์', 'tent']},
      {itemName: 'ถุงนอน', allowedUnits: ['ถุง'], keywords: ['sleeping bag']},
      {itemName: 'เปล', allowedUnits: ['เปล'], keywords: ['stretcher', 'hammock']},
      {itemName: 'เตียงสนาม', allowedUnits: ['อัน'], keywords: ['camp bed']},
    ],
  },
  {
    code: '16',
    categoryName: 'วัสดุสำรวจ',
    items: [
      {itemName: 'บันไดอลูมิเนียม', allowedUnits: ['อัน'], keywords: ['บันได', 'ladder']},
      {itemName: 'ตลับเมตร', allowedUnits: ['อัน', 'ตลับ'], keywords: ['สายวัดสำรวจ', 'tape measure']},
      {itemName: 'เสากั้นเขตแดน', allowedUnits: ['ชุด'], keywords: ['หลักเขต']},
    ],
  },
  {
    code: '17',
    categoryName: 'วัสดุดนตรี',
    items: [
      {itemName: 'ฉิ่ง', allowedUnits: ['คู่'], keywords: ['ching']},
      {itemName: 'ฉาบ', allowedUnits: ['คู่'], keywords: ['cymbal']},
      {itemName: 'ขลุ่ย', allowedUnits: ['เลา'], keywords: ['flute']},
      {itemName: 'ไม้กลอง', allowedUnits: ['คู่'], keywords: ['drumstick']},
      {itemName: 'สายกีตาร์', allowedUnits: ['เส้น'], keywords: ['guitar string']},
    ],
  },
  {
    code: '18',
    categoryName: 'วัสดุอื่น',
    items: [
      {itemName: 'หน้ากากอนามัย', allowedUnits: ['กล่อง'], keywords: ['surgical mask']},
      {itemName: 'ชุด PPE', allowedUnits: ['ชุด'], keywords: ['ppe']},
      {itemName: 'ทิชชูเปียก', allowedUnits: ['แพ็ค'], keywords: ['wet wipes']},
      {itemName: 'Power Bank', allowedUnits: ['อัน'], keywords: ['แบตสำรอง', 'powerbank']},
      {itemName: 'คูหาเลือกตั้ง', allowedUnits: ['คูหา'], keywords: ['voting booth']},
      {itemName: 'หีบเลือกตั้ง', allowedUnits: ['ใบ'], keywords: ['ballot box']},
      {itemName: 'เทปกั้นเขต', allowedUnits: ['ม้วน'], keywords: ['barricade tape']},
    ],
  },
] as const;

const CATEGORY_MAP = new Map<string, StandardMaterialCategory>(
  MATERIAL_CATEGORIES.map(category => [category.code, category]),
);

const normalize = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('th-TH').replace(/[\s\-_/(),.]+/g, ' ').trim();

export function getMaterialCategory(code: string): StandardMaterialCategory | undefined {
  return CATEGORY_MAP.get(code.trim());
}

export function findCategoryByName(categoryName: string): StandardMaterialCategory | undefined {
  const needle = normalize(categoryName);
  if (!needle) return undefined;
  return (
    MATERIAL_CATEGORIES.find(c => normalize(c.categoryName) === needle) ??
    MATERIAL_CATEGORIES.find(c => normalize(c.categoryName).includes(needle) || needle.includes(normalize(c.categoryName)))
  );
}

/**
 * Fuzzy Thai/English search across all 18 official material categories.
 * Returns standard units first while supporting custom user units downstream.
 */
export function searchStandardCatalog(query: string, categoryCode?: string): CatalogSearchResult[] {
  const trimmedCode = categoryCode?.trim();
  const categories = trimmedCode
    ? MATERIAL_CATEGORIES.filter(c => c.code === trimmedCode)
    : MATERIAL_CATEGORIES;

  const q = normalize(query);
  if (!q) {
    return categories.flatMap(category =>
      category.items.map(item => ({
        categoryCode: category.code,
        categoryName: category.categoryName,
        itemName: item.itemName,
        suggestedUnits: [...item.allowedUnits],
      })),
    );
  }

  const tokens = q.split(' ').filter(Boolean);
  const scored: Array<{score: number; result: CatalogSearchResult}> = [];

  for (const category of categories) {
    const catNorm = normalize(category.categoryName);
    for (const item of category.items) {
      const nameNorm = normalize(item.itemName);
      const kwNorms = (item.keywords ?? []).map(normalize);
      const unitNorms = item.allowedUnits.map(normalize);
      const haystack = [nameNorm, catNorm, ...kwNorms, ...unitNorms].join(' ');

      let score = 0;
      if (nameNorm === q) score = 100;
      else if (nameNorm.startsWith(q)) score = 90;
      else if (nameNorm.includes(q)) score = 80;
      else if (kwNorms.some(k => k === q)) score = 78;
      else if (kwNorms.some(k => k.includes(q) || q.includes(k))) score = 72;
      else if (q.includes(nameNorm) && nameNorm.length >= 2) score = 68;
      else if (catNorm.includes(q)) score = 55;
      else if (tokens.length > 1 && tokens.every(t => haystack.includes(t))) score = 60;
      else if (tokens.some(t => t.length >= 2 && (nameNorm.includes(t) || kwNorms.some(k => k.includes(t))))) {
        score = 45;
      }

      if (score > 0) {
        scored.push({
          score,
          result: {
            categoryCode: category.code,
            categoryName: category.categoryName,
            itemName: item.itemName,
            suggestedUnits: [...item.allowedUnits],
          },
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.result.categoryCode.localeCompare(b.result.categoryCode));
  return scored.map(entry => entry.result);
}

/** Surfaces standard units first and appends any custom user unit without duplicates. */
export function mergeSuggestedUnits(standardUnits: readonly string[], customUnit?: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const u of standardUnits) {
    const clean = u.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  const extra = customUnit?.trim();
  if (extra && !seen.has(extra)) result.push(extra);
  return result;
}
