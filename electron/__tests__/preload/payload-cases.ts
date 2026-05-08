import { expect, it } from 'vitest';
import { sanitizePayload } from './helpers';

export function registerPreloadPayloadTests() {
  it.each([
    ['SEC-001: null passes through', null, null],
    ['SEC-002: undefined passes through', undefined, undefined],
    ['SEC-003: string primitive passes through', 'hello', 'hello'],
    ['SEC-004: number primitive passes through', 42, 42],
    ['SEC-005: boolean primitive passes through', true, true],
    ['SEC-013: empty object passes', {}, {}],
    ['SEC-014: empty array passes', [], []],
  ])('%s', (_label, input, expected) => {
    expect(sanitizePayload(input)).toEqual(expected);
  });

  it('SEC-006: function payload throws Security Violation', () => {
    expect(() => sanitizePayload(() => {})).toThrow(
      'Security Violation: Callbacks and functions are not allowed in IPC.',
    );
  });

  it('SEC-007: object with nested values sanitized', () => {
    expect(sanitizePayload({ a: { b: 1, c: 'test' } })).toEqual({ a: { b: 1, c: 'test' } });
  });

  it('SEC-008: object prototype stripped via spread', () => {
    class Evil {
      data = 'safe';
      dangerousMethod() { return 'hacked'; }
    }
    const result = sanitizePayload(new Evil());
    expect(result.data).toBe('safe');
    expect(result).not.toBeInstanceOf(Evil);
  });

  it('SEC-009/SEC-015: arrays recursively sanitize mixed safe values', () => {
    expect(sanitizePayload([{ a: 1 }, { b: 2 }, 'text'])).toEqual([{ a: 1 }, { b: 2 }, 'text']);
    expect(sanitizePayload([1, 'text', { key: true }, [2, 3]])).toEqual([1, 'text', { key: true }, [2, 3]]);
  });

  it('SEC-010/SEC-011: nested function payloads throw', () => {
    expect(() => sanitizePayload([1, () => {}, 3])).toThrow('Security Violation');
    expect(() => sanitizePayload({ a: { b: { c: () => {} } } })).toThrow('Security Violation');
  });

  it('SEC-012: deeply nested safe object passes', () => {
    const deep = { l1: { l2: { l3: { l4: { value: 'deep' } } } } };
    expect(sanitizePayload(deep).l1.l2.l3.l4.value).toBe('deep');
  });

  it('SEC-033/SEC-034: strips prototype keys and rejects excessive depth', () => {
    expect(sanitizePayload(JSON.parse('{"safe":1,"__proto__":{"polluted":true}}'))).toEqual({ safe: 1 });
    let payload: any = { value: true };
    for (let index = 0; index < 25; index += 1) payload = { nested: payload };
    expect(() => sanitizePayload(payload)).toThrow(/deeply nested/);
  });
}
