// Rat Race tile types — mirrors server/src/engine/board.ts
export type RatTileType =
  | 'deal'
  | 'payday'
  | 'market'
  | 'doodad'
  | 'charity'
  | 'downsized'
  | 'baby'
  | 'start';

const RAT_MAP: Record<number, RatTileType> = {};
const set = (ps: number[], t: RatTileType) => ps.forEach((p) => (RAT_MAP[p] = t));
set([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23], 'deal');
set([6, 14, 22], 'payday');
set([8, 16, 24], 'market');
set([2, 10, 18], 'doodad');
set([4], 'charity');
set([12], 'downsized');
set([20], 'baby');

export const ratTileType = (position: number): RatTileType => RAT_MAP[position] ?? 'deal';

export interface Cell {
  row: number;
  col: number;
}

/** Clockwise perimeter coordinates of an SxS grid, starting top-left. */
export const perimeter = (S: number): Cell[] => {
  const cells: Cell[] = [];
  for (let c = 1; c <= S; c++) cells.push({ row: 1, col: c }); // top row →
  for (let r = 2; r <= S; r++) cells.push({ row: r, col: S }); // right col ↓
  for (let c = S - 1; c >= 1; c--) cells.push({ row: S, col: c }); // bottom row ←
  for (let r = S - 1; r >= 2; r--) cells.push({ row: r, col: 1 }); // left col ↑
  return cells;
};

export const RAT_GRID = 7; // 7x7 perimeter = 24 cells
export const ratCells = perimeter(RAT_GRID);

export const FT_GRID = 9; // 9x9 perimeter = 32 cells
export const ftCells = perimeter(FT_GRID);

export const tileLabel: Record<RatTileType, { th: string; en: string; icon: string }> = {
  deal: { th: 'ดีล', en: 'Deal', icon: '💼' },
  payday: { th: 'เงินเดือน', en: 'Payday', icon: '💵' },
  market: { th: 'ตลาด', en: 'Market', icon: '📈' },
  doodad: { th: 'รายจ่าย', en: 'Doodad', icon: '🛍️' },
  charity: { th: 'การกุศล', en: 'Charity', icon: '❤️' },
  downsized: { th: 'ตกงาน', en: 'Downsized', icon: '📉' },
  baby: { th: 'มีลูก', en: 'Baby', icon: '👶' },
  start: { th: 'เริ่ม', en: 'Start', icon: '🏁' }
};
