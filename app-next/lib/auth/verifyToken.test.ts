import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyToken } from './verifyToken.js';

describe('verifyToken (bypass mode)', () => {
  beforeEach(() => { process.env.WS_AUTH_BYPASS = '1'; });
  afterEach(() => { delete process.env.WS_AUTH_BYPASS; });

  it('parses a test token into a user', async () => {
    expect(await verifyToken('test:abc:Alice')).toEqual({ uid: 'abc', name: 'Alice', picture: undefined });
  });
  it('returns null for a missing or malformed token', async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken('garbage')).toBeNull();
  });
});

describe('verifyToken (real path — bypass OFF)', () => {
  const saved = process.env.WS_AUTH_BYPASS;
  beforeEach(() => { delete process.env.WS_AUTH_BYPASS; });
  afterEach(() => {
    if (saved !== undefined) process.env.WS_AUTH_BYPASS = saved;
    else delete process.env.WS_AUTH_BYPASS;
  });

  it('resolves the firebaseAdmin module without throwing MODULE_NOT_FOUND', async () => {
    // Proves the extensionless import resolves under the test bundler.
    await expect(import('../firebaseAdmin')).resolves.toBeDefined();
  });

  it('returns null for a bogus token (not a thrown MODULE_NOT_FOUND)', async () => {
    // firebase-admin will reject the invalid token; verifyToken must catch it → null.
    const result = await verifyToken('not-a-real-token');
    expect(result).toBeNull();
  });
});
