import type { Dream, FastTrackTile } from '../engine/types.js';

// Win on the Fast Track by either buying your Dream, or by gaining this much
// extra monthly cash flow from Fast Track investments.
export const FAST_TRACK_CASHFLOW_GOAL = 50000;

export const DREAMS: Dream[] = [
  { id: 'orphanage', name: 'Build an orphanage', nameTh: 'สร้างบ้านเด็กกำพร้า', cost: 100000 },
  { id: 'island', name: 'Buy a private island', nameTh: 'ซื้อเกาะส่วนตัว', cost: 250000 },
  { id: 'jet', name: 'Own a private jet', nameTh: 'มีเครื่องบินเจ็ตส่วนตัว', cost: 200000 },
  { id: 'mediterranean', name: 'A year sailing the Mediterranean', nameTh: 'ล่องเรือเมดิเตอร์เรเนียน 1 ปี', cost: 120000 },
  { id: 'politics', name: 'Run for political office', nameTh: 'ลงสมัครรับเลือกตั้ง', cost: 100000 },
  { id: 'penthouse', name: 'Live in a penthouse', nameTh: 'อยู่เพนต์เฮาส์ใจกลางเมือง', cost: 150000 },
  { id: 'space', name: 'Take a trip into space', nameTh: 'ท่องอวกาศ', cost: 250000 },
  { id: 'foundation', name: 'Start a charitable foundation', nameTh: 'ก่อตั้งมูลนิธิการกุศล', cost: 100000 }
];

// Fast Track board laid out as a loop. Investments add monthly cash flow.
// Tile 0 is the entry / cashflow-day tile.
export const FAST_TRACK_BOARD: FastTrackTile[] = [
  { index: 0, kind: 'cashflowDay' },
  { index: 1, kind: 'investment', id: 'software', name: 'Software company', nameTh: 'บริษัทซอฟต์แวร์', cost: 200000, cashFlow: 20000 },
  { index: 2, kind: 'dream', id: 'orphanage' },
  { index: 3, kind: 'investment', id: 'pizza', name: 'Pizza franchise (10)', nameTh: 'แฟรนไชส์พิซซ่า 10 สาขา', cost: 100000, cashFlow: 10000 },
  { index: 4, kind: 'charity' },
  { index: 5, kind: 'investment', id: 'apartments', name: 'Apartment complex', nameTh: 'อาคารอพาร์ตเมนต์', cost: 150000, cashFlow: 15000 },
  { index: 6, kind: 'dream', id: 'island' },
  { index: 7, kind: 'cashflowDay' },
  { index: 8, kind: 'investment', id: 'carwash', name: 'Car wash chain', nameTh: 'เครือร้านล้างรถ', cost: 80000, cashFlow: 8000 },
  { index: 9, kind: 'loss', name: 'Tax audit — pay half your cash', nameTh: 'ถูกตรวจภาษี — จ่ายเงินสดครึ่งหนึ่ง', half: true },
  { index: 10, kind: 'dream', id: 'jet' },
  { index: 11, kind: 'investment', id: 'goldmine', name: 'Gold mine', nameTh: 'เหมืองทอง', cost: 120000, cashFlow: 12000 },
  { index: 12, kind: 'cashflowDay' },
  { index: 13, kind: 'investment', id: 'tvstation', name: 'TV station', nameTh: 'สถานีโทรทัศน์', cost: 250000, cashFlow: 25000 },
  { index: 14, kind: 'dream', id: 'mediterranean' },
  { index: 15, kind: 'charity' },
  { index: 16, kind: 'investment', id: 'hotel', name: 'Resort hotel', nameTh: 'โรงแรมรีสอร์ต', cost: 175000, cashFlow: 17500 },
  { index: 17, kind: 'dream', id: 'politics' },
  { index: 18, kind: 'cashflowDay' },
  { index: 19, kind: 'investment', id: 'oilwells', name: 'Oil wells', nameTh: 'บ่อน้ำมัน', cost: 90000, cashFlow: 9000 },
  { index: 20, kind: 'loss', name: 'Lawsuit — pay half your cash', nameTh: 'ถูกฟ้องร้อง — จ่ายเงินสดครึ่งหนึ่ง', half: true },
  { index: 21, kind: 'dream', id: 'penthouse' },
  { index: 22, kind: 'investment', id: 'shoppingmall', name: 'Shopping mall', nameTh: 'ศูนย์การค้า', cost: 220000, cashFlow: 22000 },
  { index: 23, kind: 'cashflowDay' },
  { index: 24, kind: 'investment', id: 'airline', name: 'Regional airline', nameTh: 'สายการบินภูมิภาค', cost: 300000, cashFlow: 30000 },
  { index: 25, kind: 'dream', id: 'space' },
  { index: 26, kind: 'charity' },
  { index: 27, kind: 'investment', id: 'brewery', name: 'Craft brewery', nameTh: 'โรงเบียร์คราฟต์', cost: 110000, cashFlow: 11000 },
  { index: 28, kind: 'dream', id: 'foundation' },
  { index: 29, kind: 'cashflowDay' },
  { index: 30, kind: 'investment', id: 'datacenter', name: 'Data center', nameTh: 'ศูนย์ข้อมูล', cost: 260000, cashFlow: 26000 },
  { index: 31, kind: 'loss', name: 'Divorce — pay all your cash', nameTh: 'หย่าร้าง — จ่ายเงินสดทั้งหมด', full: true }
];

export const FAST_TRACK_SIZE = FAST_TRACK_BOARD.length;
