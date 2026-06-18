import { describe, it, expect } from 'vitest';
import { ratRaceTileType } from './board.js';

describe('Rat Race tile layout (L1)', () => {
  it('Baby is at 12 and Downsized at 20', () => {
    expect(ratRaceTileType(12)).toBe('baby');
    expect(ratRaceTileType(20)).toBe('downsized');
  });
});
