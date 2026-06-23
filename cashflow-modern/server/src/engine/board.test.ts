import { describe, it, expect } from 'vitest';
import { ratRaceTileType, ratRaceTileTypeFor, RAT_RACE_SIZE } from './board.js';

describe('Rat Race tile layout (L1)', () => {
  it('Baby is at 12 and Downsized at 20', () => {
    expect(ratRaceTileType(12)).toBe('baby');
    expect(ratRaceTileType(20)).toBe('downsized');
  });
});

describe('Payday density by difficulty (A5)', () => {
  it('normal: 3 payday tiles at 6/14/22', () => {
    const tiles = Array.from({ length: RAT_RACE_SIZE }, (_, i) => ratRaceTileTypeFor(i + 1, 'normal'));
    expect(tiles.filter((t) => t === 'payday').length).toBe(3);
    expect(ratRaceTileTypeFor(17, 'normal')).toBe('deal');
  });

  it('easy: 5 payday tiles for faster cash flow', () => {
    const tiles = Array.from({ length: RAT_RACE_SIZE }, (_, i) => ratRaceTileTypeFor(i + 1, 'easy'));
    expect(tiles.filter((t) => t === 'payday').length).toBe(5);
    // The two extra payday tiles replace deals, not special tiles.
    expect(ratRaceTileTypeFor(12, 'easy')).toBe('baby');
    expect(ratRaceTileTypeFor(20, 'easy')).toBe('downsized');
  });
});
