import { describe, it, expect } from 'vitest';
import { makeCode } from './roomCode.js';

describe('makeCode', () => {
  it('returns a 5-char code from the unambiguous alphabet', () => {
    const code = makeCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  });
  it('is reasonably unique across calls', () => {
    const codes = new Set(Array.from({ length: 200 }, () => makeCode()));
    expect(codes.size).toBeGreaterThan(190); // collisions extremely unlikely
  });
});
