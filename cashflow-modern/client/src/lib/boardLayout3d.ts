// Pure math for the 3D board: ring coordinates (XZ plane, Y up) + tile colors.
// Colors mirror the CSS palette in styles/index.css so 3D matches the DOM fallback.
import { ratTileType, type RatTileType } from './boardLayout';
import type { FastTrackTile } from './types';

export interface RingPoint {
  x: number;
  z: number;
  angle: number;
}

/** `count` tile centers evenly spaced on a circle of `radius`, starting at the top (north). */
export function ringPositions(count: number, radius: number): RingPoint[] {
  const step = (2 * Math.PI) / count;
  const start = -Math.PI / 2; // top of the circle, matches the CSS board's -90deg start
  const points: RingPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = start + i * step;
    points.push({ x: radius * Math.cos(angle), z: radius * Math.sin(angle), angle });
  }
  return points;
}

export const RAT_TILE_COLOR: Record<RatTileType, string> = {
  deal: '#2f6ff0',
  payday: '#2ecc71',
  market: '#8e44ad',
  doodad: '#c0653b',
  charity: '#d63384',
  downsized: '#e74c3c',
  baby: '#16a3b8',
  start: '#f1c40f'
};

export const FT_TILE_COLOR: Record<FastTrackTile['kind'], string> = {
  cashflowDay: '#f1c40f',
  investment: '#2f6ff0',
  dream: '#caa33a',
  charity: '#d63384',
  loss: '#e74c3c',
  doodad: '#c0653b'
};

export function ratTileColor(position: number): string {
  return RAT_TILE_COLOR[ratTileType(position)];
}

/** Fan tokens that share a tile along a small arc so they don't overlap. */
export function tokenSlotOffset(
  index: number,
  total: number,
  spread: number
): { dx: number; dz: number } {
  if (total <= 1) return { dx: 0, dz: 0 };
  const a = (index - (total - 1) / 2) * spread;
  return { dx: a, dz: 0 };
}
