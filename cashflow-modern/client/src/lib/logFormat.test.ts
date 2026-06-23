import { describe, it, expect } from 'vitest';
import { formatLog, soundForLog, LogEntry } from './logFormat';

describe('formatLog — Thai translation', () => {
  it('formats "received payday" with amount', () => {
    const e: LogEntry = { ts: 0, player: 'Alice', color: '#fff', code: 'payday', params: { amount: 1500 } };
    expect(formatLog(e, 'th')).toBe('ได้รับเงินเดือน $1,500');
    expect(formatLog(e, 'en')).toBe('received payday $1,500');
  });

  it('formats "rolled" with dice values', () => {
    const e: LogEntry = { ts: 0, player: 'Bob', color: '#fff', code: 'rolled', params: { dice: [3, 4], total: 7 } };
    expect(formatLog(e, 'th')).toBe('ทอยได้ 3 + 4 = 7');
    expect(formatLog(e, 'en')).toBe('rolled 3 + 4 = 7');
  });

  it('formats "downsized" with amount and turn count', () => {
    const e: LogEntry = { ts: 0, player: 'X', color: '#fff', code: 'downsized', params: { amount: 2000, turns: 1 } };
    expect(formatLog(e, 'th')).toBe('ตกงาน! จ่าย $2,000 และเสียเทิร์น 1 ครั้ง');
  });

  it('formats "won" with reason', () => {
    const e: LogEntry = { ts: 0, player: 'A', color: '#fff', code: 'won', params: { reason: 'bought their dream: Jet' } };
    expect(formatLog(e, 'th')).toContain('🏆 ชนะเกม');
  });
});

describe('soundForLog — by code', () => {
  it('maps payday → payday', () => {
    expect(soundForLog({ ts: 0, player: '', color: '', code: 'payday', params: {} })).toBe('payday');
  });
  it('maps unknown code → null', () => {
    expect(soundForLog({ ts: 0, player: '', color: '', code: 'whatever', params: {} })).toBeNull();
  });
});
