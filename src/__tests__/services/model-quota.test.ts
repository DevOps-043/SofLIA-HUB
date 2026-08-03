import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumePulseMaxUse,
  currentPeriod,
  hasPulseMaxQuota,
  PULSE_MAX_MONTHLY_LIMIT,
  readPulseMaxQuota,
  recordPulseMaxTokens,
  remainingPulseMaxUses,
  resetPulseMaxQuota,
} from '../../services/model-quota';

describe('Cuota mensual de Pulse Max', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('MQ-001: arranca con el limite completo disponible', () => {
    expect(PULSE_MAX_MONTHLY_LIMIT).toBe(3);
    expect(remainingPulseMaxUses('user-1')).toBe(3);
    expect(hasPulseMaxQuota('user-1')).toBe(true);
  });

  it('MQ-002: se agota tras el tercer uso del mes', () => {
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');
    expect(hasPulseMaxQuota('user-1')).toBe(true);

    consumePulseMaxUse('user-1');

    expect(remainingPulseMaxUses('user-1')).toBe(0);
    expect(hasPulseMaxQuota('user-1')).toBe(false);
  });

  it('MQ-003: al cambiar de mes el contador se reinicia solo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T10:00:00Z'));
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');
    expect(hasPulseMaxQuota('user-1')).toBe(false);

    vi.setSystemTime(new Date('2026-09-01T10:00:00Z'));

    expect(remainingPulseMaxUses('user-1')).toBe(3);
    expect(readPulseMaxQuota('user-1').periodo).toBe(currentPeriod());
  });

  it('MQ-004: acumula los tokens gastados en el periodo', () => {
    consumePulseMaxUse('user-1');
    recordPulseMaxTokens('user-1', 1200);
    recordPulseMaxTokens('user-1', 800);
    // Valores no utilizables no deben ensuciar el contador.
    recordPulseMaxTokens('user-1', Number.NaN);
    recordPulseMaxTokens('user-1', -50);

    expect(readPulseMaxQuota('user-1').tokens).toBe(2000);
  });

  it('MQ-005: la cuota tiene alcance por usuario', () => {
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');

    expect(hasPulseMaxQuota('user-1')).toBe(false);
    expect(remainingPulseMaxUses('user-2')).toBe(3);
  });

  it('MQ-006: un valor corrupto en almacenamiento no rompe la lectura', () => {
    localStorage.setItem('pulse:max-quota:user-1', '{no es json');

    expect(remainingPulseMaxUses('user-1')).toBe(3);
  });

  it('MQ-007: el reset devuelve la cuota completa', () => {
    consumePulseMaxUse('user-1');
    resetPulseMaxQuota('user-1');

    expect(remainingPulseMaxUses('user-1')).toBe(3);
  });
});
