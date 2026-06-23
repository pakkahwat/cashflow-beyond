import { describe, it, expect } from 'vitest';
import cards from './cards.json';

describe('cards.json (C7)', () => {
  it('has no duplicate ids within any deck', () => {
    const dupes: string[] = [];
    for (const [deck, list] of Object.entries(cards as Record<string, { id: string }[]>)) {
      const seen = new Set<string>();
      for (const c of list) {
        if (seen.has(c.id)) dupes.push(`${deck}:${c.id}`);
        seen.add(c.id);
      }
    }
    expect(dupes).toEqual([]);
  });
});
