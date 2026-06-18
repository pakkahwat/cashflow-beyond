import { describe, it, expect } from 'vitest';
import {
  ringPositions,
  ratTileColor,
  RAT_TILE_COLOR,
  FT_TILE_COLOR,
  tokenSlotOffset
} from './boardLayout3d';

describe('ringPositions', () => {
  it('returns one point per count', () => {
    expect(ringPositions(24, 10)).toHaveLength(24);
    expect(ringPositions(32, 12)).toHaveLength(32);
  });

  it('starts at the top (north) of the circle', () => {
    const p = ringPositions(4, 10)[0];
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(-10, 5);
    expect(p.angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('spaces points evenly around the full circle', () => {
    const pts = ringPositions(4, 5);
    for (const pt of pts) {
      expect(Math.hypot(pt.x, pt.z)).toBeCloseTo(5, 5);
    }
    expect(pts[1].x).toBeCloseTo(5, 5);
    expect(pts[1].z).toBeCloseTo(0, 5);
  });
});

describe('tile colors', () => {
  it('maps every Rat Race tile type to a hex color', () => {
    for (const c of Object.values(RAT_TILE_COLOR)) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('maps every Fast Track kind to a hex color', () => {
    for (const c of Object.values(FT_TILE_COLOR)) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('ratTileColor uses the tile type at a position', () => {
    expect(ratTileColor(6)).toBe(RAT_TILE_COLOR.payday);
    expect(ratTileColor(1)).toBe(RAT_TILE_COLOR.deal);
  });
});

describe('tokenSlotOffset', () => {
  it('is centered for a single token', () => {
    expect(tokenSlotOffset(0, 1, 0.4)).toEqual({ dx: 0, dz: 0 });
  });

  it('fans multiple tokens symmetrically around zero', () => {
    const a = tokenSlotOffset(0, 2, 0.4);
    const b = tokenSlotOffset(1, 2, 0.4);
    expect(a.dx).toBeCloseTo(-0.2, 5);
    expect(b.dx).toBeCloseTo(0.2, 5);
    expect(a.dx + b.dx).toBeCloseTo(0, 5);
  });
});
