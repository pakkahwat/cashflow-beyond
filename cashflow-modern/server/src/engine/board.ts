import type { TileType } from './types.js';

export const RAT_RACE_SIZE = 24;

// Position -> tile type. Positions are 1..24 (a full lap is 24 steps).
const TILE_MAP: Record<number, TileType> = {};
const assign = (positions: number[], type: TileType) => {
  positions.forEach((p) => (TILE_MAP[p] = type));
};

assign([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23], 'deal');
assign([6, 14, 22], 'payday');
assign([8, 16, 24], 'market');
assign([2, 10, 18], 'doodad');
assign([4], 'charity');
assign([12], 'downsized');
assign([20], 'baby');

export const ratRaceTileType = (position: number): TileType => TILE_MAP[position];

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
