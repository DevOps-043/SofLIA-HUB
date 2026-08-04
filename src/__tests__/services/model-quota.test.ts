import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeSofliaMaxUse,
  currentPeriod,
  hasSofliaMaxQuota,
  SOFLIA_MAX_MONTHLY_LIMIT,
  readSofliaMaxQuota,
  recordSofliaMaxTokens,
  remainingSofliaMaxUses,
  resetSofliaMaxQuota,
} from '../../services/model-quota';

describe('Cuota mensual de SofLIA Max', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('MQ-001: arranca con el limite completo disponible', () => {
    expect(SOFLIA_MAX_MONTHLY_LIMIT).toBe(3);
    expect(remainingSofliaMaxUses('user-1')).toBe(3);
    expect(hasSofliaMaxQuota('user-1')).toBe(true);
  });

  it('MQ-002: se agota tras el tercer uso del mes', () => {
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');
    expect(hasSofliaMaxQuota('user-1')).toBe(true);

    consumeSofliaMaxUse('user-1');

    expect(remainingSofliaMaxUses('user-1')).toBe(0);
    expect(hasSofliaMaxQuota('user-1')).toBe(false);
  });

  it('MQ-003: al cambiar de mes el contador se reinicia solo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T10:00:00Z'));
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');
    expect(hasSofliaMaxQuota('user-1')).toBe(false);

    vi.setSystemTime(new Date('2026-09-01T10:00:00Z'));

    expect(remainingSofliaMaxUses('user-1')).toBe(3);
    expect(readSofliaMaxQuota('user-1').periodo).toBe(currentPeriod());
  });

  it('MQ-004: acumula los tokens gastados en el periodo', () => {
    consumeSofliaMaxUse('user-1');
    recordSofliaMaxTokens('user-1', 1200);
    recordSofliaMaxTokens('user-1', 800);
    // Valores no utilizables no deben ensuciar el contador.
    recordSofliaMaxTokens('user-1', Number.NaN);
    recordSofliaMaxTokens('user-1', -50);

    expect(readSofliaMaxQuota('user-1').tokens).toBe(2000);
  });

  it('MQ-005: la cuota tiene alcance por usuario', () => {
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');

    expect(hasSofliaMaxQuota('user-1')).toBe(false);
    expect(remainingSofliaMaxUses('user-2')).toBe(3);
  });

  it('MQ-006: un valor corrupto en almacenamiento no rompe la lectura', () => {
    localStorage.setItem('pulse:max-quota:user-1', '{no es json');

    expect(remainingSofliaMaxUses('user-1')).toBe(3);
  });

  it('MQ-007: el reset devuelve la cuota completa', () => {
    consumeSofliaMaxUse('user-1');
    resetSofliaMaxQuota('user-1');

    expect(remainingSofliaMaxUses('user-1')).toBe(3);
  });
});
