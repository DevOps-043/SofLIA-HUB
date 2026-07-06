import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_OWNER_KEY,
  isValidOwnerKey,
  ownerKind,
  phoneOwnerKey,
  resolveWhatsAppOwnerKey,
  userOwnerKey,
} from '../memory/scope';

describe('Owner key builders', () => {
  it('MS-001: userId → user:<id> (forma que unifica superficies)', () => {
    expect(userOwnerKey('abc-123')).toBe('user:abc-123');
    expect(userOwnerKey('  u1 ')).toBe('user:u1');
  });
  it('MS-002: userId vacío cae al owner local', () => {
    expect(userOwnerKey('')).toBe(LOCAL_OWNER_KEY);
    expect(userOwnerKey('   ')).toBe(LOCAL_OWNER_KEY);
  });
  it('MS-003: teléfono se normaliza a dígitos', () => {
    expect(phoneOwnerKey('+52 1 55-31-72-16-80')).toBe('phone:5215531721680');
    expect(phoneOwnerKey('')).toBe(LOCAL_OWNER_KEY);
  });
  it('MS-004: ownerKind clasifica', () => {
    expect(ownerKind('user:x')).toBe('user');
    expect(ownerKind('phone:5215')).toBe('phone');
    expect(ownerKind(LOCAL_OWNER_KEY)).toBe('local');
  });
  it('MS-005: isValidOwnerKey', () => {
    expect(isValidOwnerKey('user:x')).toBe(true);
    expect(isValidOwnerKey('phone:1')).toBe(true);
    expect(isValidOwnerKey('local:owner')).toBe(true);
    expect(isValidOwnerKey('5215531721680')).toBe(false);
    expect(isValidOwnerKey(null)).toBe(false);
  });
});

describe('resolveWhatsAppOwnerKey', () => {
  it('MS-010: si el teléfono resuelve a un userId, unifica en user:<id>', async () => {
    const resolver = vi.fn(async () => 'sofia-42');
    expect(await resolveWhatsAppOwnerKey('5215531721680', resolver)).toBe('user:sofia-42');
    expect(resolver).toHaveBeenCalledWith('5215531721680');
  });
  it('MS-011: sin userId cae al scope por teléfono (aislado, no mezcla)', async () => {
    expect(await resolveWhatsAppOwnerKey('+52 155 3172', async () => null)).toBe('phone:521553172');
  });
  it('MS-012: si el resolver lanza, cae al scope por teléfono sin romper', async () => {
    expect(await resolveWhatsAppOwnerKey('5215531721680', async () => { throw new Error('db'); })).toBe('phone:5215531721680');
  });
});
