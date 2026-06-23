import type { TileType } from './types.js';

export const RAT_RACE_SIZE = 24;

// Position -> tile type. Positions are 1..24 (a full lap is 24 steps).
// `normal` is the rulebook layout. `easy` promotes two deal tiles to payday so
// cash flows into the bankroll faster — the only board-level easy-mode change.
const NORMAL_MAP: Record<number, TileType> = {};
const EASY_MAP: Record<number, TileType> = {};
const assign = (map: Record<number, TileType>, positions: number[], type: TileType) => {
  positions.forEach((p) => (map[p] = type));
};
assign(NORMAL_MAP, [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23], 'deal');
assign(NORMAL_MAP, [6, 14, 22], 'payday');
assign(NORMAL_MAP, [8, 16, 24], 'market');
assign(NORMAL_MAP, [2, 10, 18], 'doodad');
assign(NORMAL_MAP, [4], 'charity');
assign(NORMAL_MAP, [20], 'downsized');
assign(NORMAL_MAP, [12], 'baby');

// Easy: same board, but two extra payday tiles (9 and 17) replace deals.
EASY_MAP[9] = 'payday';
EASY_MAP[17] = 'payday';
for (let i = 1; i <= RAT_RACE_SIZE; i++) EASY_MAP[i] ??= NORMAL_MAP[i];

export const ratRaceTileType = (position: number): TileType => NORMAL_MAP[position];
export const ratRaceTileTypeFor = (position: number, difficulty: 'normal' | 'easy'): TileType =>
  difficulty === 'easy' ? EASY_MAP[position] : NORMAL_MAP[position];

// Tiles a player crosses (exclusive of start, inclusive of end) going from
// `from` to `to`, used to award Payday when passing/landing on a payday tile.
export const tilesCrossed = (from: number, to: number, steps: number): number[] => {
  const crossed: number[] = [];
  for (let i = 1; i <= steps; i++) {
    let pos = (from + i) % RAT_RACE_SIZE;
    if (pos === 0) pos = RAT_RACE_SIZE;
    crossed.push(pos);
  }
  return crossed;
};
