import { describe, it, expect, beforeEach } from 'vitest';
import { verifyToken } from './verifyToken.js';

describe('verifyToken (bypass mode)', () => {
  beforeEach(() => { process.env.WS_AUTH_BYPASS = '1'; });
  it('parses a test token into a user', async () => {
    expect(await verifyToken('test:abc:Alice')).toEqual({ uid: 'abc', name: 'Alice', picture: undefined });
  });
  it('returns null for a missing or malformed token', async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken('garbage')).toBeNull();
  });
});
