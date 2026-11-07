import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecoveryReviewLifetime } from '../integrated-browser/recovery-review-lifetime';

let monotonic: bigint;
let wall: number;
beforeEach(() => {
  monotonic = 10_000n; wall = Date.UTC(2026, 9, 25);
  vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => monotonic);
  vi.spyOn(Date, 'now').mockImplementation(() => wall);
});
afterEach(() => vi.restoreAllMocks());

describe('vigencia de revisión de recuperación', () => {
  it('admite un consumo y permite revalidar ese intento todavía vigente', () => {
    const review = createRecoveryReviewLifetime(); expect(review.consume()).toBe(true);
    expect(review.consume()).toBe(false); expect(review.expired()).toBe(false);
  });
  it('admite el instante anterior al límite monotónico y rechaza el límite exacto', () => {
    const a = createRecoveryReviewLifetime(), b = createRecoveryReviewLifetime();
    monotonic += 299_999_999_999n;
    expect(a.consume()).toBe(true); expect(a.expired()).toBe(false);
    monotonic++; expect(a.expired()).toBe(true); expect(b.consume()).toBe(false);
  });
  it('mantiene el límite civil de cinco minutos aunque el monotónico no avance', () => {
    const review = createRecoveryReviewLifetime(); wall += 299_999;
    expect(review.expired()).toBe(false); wall++; expect(review.expired()).toBe(true);
    expect(review.consume()).toBe(false);
  });
  it('retroceder el reloj civil no amplía los cinco minutos de intervalo', () => {
    const review = createRecoveryReviewLifetime(); wall -= 3_600_000; monotonic += 300_000_000_000n;
    expect(review.consume()).toBe(false); expect(review.expired()).toBe(true);
  });
  it('corregir el reloj después de observar vencimiento no reactiva la revisión', () => {
    const review = createRecoveryReviewLifetime(), original = wall;
    wall += 300_001; expect(review.expired()).toBe(true); wall = original;
    expect(review.expired()).toBe(true); expect(review.consume()).toBe(false);
  });
  it('un avance monotónico vencido no puede deshacerse en el mismo objeto', () => {
    const review = createRecoveryReviewLifetime(), original = monotonic;
    monotonic += 300_000_000_000n; expect(review.expired()).toBe(true); monotonic = original;
    expect(review.expired()).toBe(true); expect(review.consume()).toBe(false);
  });
  it('una revisión nueva fija su plazo propio sin compartir consumo o vencimiento', () => {
    const first = createRecoveryReviewLifetime(); expect(first.consume()).toBe(true);
    monotonic += 180_000_000_000n; wall += 180_000;
    const second = createRecoveryReviewLifetime(); monotonic += 120_000_000_000n; wall += 120_000;
    expect(first.expired()).toBe(true); expect(second.consume()).toBe(true);
    expect(second.expired()).toBe(false); expect(first.consume()).toBe(false);
  });
});
