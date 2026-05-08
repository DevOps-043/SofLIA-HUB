import { describe, expect, it } from 'vitest';
import { sanitizePayload } from './helpers';

describe('Preload payload sanitization', () => {
  it('SEC-001: null passes through', () => {
    expect(sanitizePayload(null)).toBeNull();
  });

  it('SEC-002: undefined passes through', () => {
    expect(sanitizePayload(undefined)).toBeUndefined();
  });

  it('SEC-003: string primitive passes through', () => {
    expect(sanitizePayload('hello')).toBe('hello');
  });

  it('SEC-004: number primitive passes through', () => {
    expect(sanitizePayload(42)).toBe(42);
  });

  it('SEC-005: boolean primitive passes through', () => {
    expect(sanitizePayload(true)).toBe(true);
  });

  it('SEC-006: function payload throws Security Violation', () => {
    expect(() => sanitizePayload(() => {})).toThrow('Security Violation');
  });

  it('SEC-007: object with nested values is sanitized', () => {
    expect(sanitizePayload({ a: { b: 1, c: 'test' } })).toEqual({ a: { b: 1, c: 'test' } });
  });

  it('SEC-008: object prototype is stripped via spread', () => {
    class Evil {
      data = 'safe';
      dangerousMethod() { return 'hacked'; }
    }
    const result = sanitizePayload(new Evil());
    expect(result.data).toBe('safe');
    expect(result).not.toBeInstanceOf(Evil);
  });

  it('SEC-009: arrays are recursively sanitized', () => {
    expect(sanitizePayload([{ a: 1 }, { b: 2 }, 'text'])).toEqual([{ a: 1 }, { b: 2 }, 'text']);
  });

  it('SEC-010: function inside array throws', () => {
    expect(() => sanitizePayload([1, () => {}, 3])).toThrow('Security Violation');
  });

  it('SEC-011: deeply nested function throws', () => {
    expect(() => sanitizePayload({ a: { b: { c: () => {} } } })).toThrow('Security Violation');
  });

  it('SEC-012: deeply nested safe object passes', () => {
    const result = sanitizePayload({ l1: { l2: { l3: { l4: { value: 'deep' } } } } });
    expect(result.l1.l2.l3.l4.value).toBe('deep');
  });

  it('SEC-013: empty object passes', () => {
    expect(sanitizePayload({})).toEqual({});
  });

  it('SEC-014: empty array passes', () => {
    expect(sanitizePayload([])).toEqual([]);
  });

  it('SEC-015: mixed array with objects and primitives passes', () => {
    expect(sanitizePayload([1, 'text', { key: true }, [2, 3]])).toEqual([1, 'text', { key: true }, [2, 3]]);
  });

  it('SEC-033: prototype pollution keys are stripped', () => {
    const result = sanitizePayload(JSON.parse('{"safe":true,"__proto__":{"polluted":true},"constructor":{"x":1}}'));
    expect(result).toEqual({ safe: true });
    expect(({} as any).polluted).toBeUndefined();
  });

  it('SEC-034: overly deep payloads are rejected', () => {
    let payload: any = { value: 'end' };
    for (let index = 0; index < 25; index += 1) payload = { nested: payload };
    expect(() => sanitizePayload(payload)).toThrow(/deeply nested/);
  });
});
