import { describe, expect, it } from 'vitest';
import { getCurrentOwnerKey, getCurrentUserId, setCurrentUserId } from '../memory/owner-context';

describe('Owner actual del equipo', () => {
  it('OC-001: sin usuario, el owner es local', () => {
    setCurrentUserId(null);
    expect(getCurrentUserId()).toBeNull();
    expect(getCurrentOwnerKey()).toBe('local:owner');
  });
  it('OC-002: con usuario, el owner es user:<id>', () => {
    setCurrentUserId('sofia-99');
    expect(getCurrentUserId()).toBe('sofia-99');
    expect(getCurrentOwnerKey()).toBe('user:sofia-99');
  });
  it('OC-003: string vacío/espacios vuelve a local', () => {
    setCurrentUserId('sofia-99');
    setCurrentUserId('   ');
    expect(getCurrentOwnerKey()).toBe('local:owner');
    setCurrentUserId(null);
  });
});
