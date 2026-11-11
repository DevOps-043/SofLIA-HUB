import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEventSchema, updateEventSchema } from '../calendar/ipc-contract';

describe('Validación real con presupuesto de colección', () => {
  it.each(['array-max', 'array-length', 'set-max', 'map-max'] as const)('rechaza %s excesivo antes de validar sus hijos', kind => {
    let visits = 0;
    const child = z.number().superRefine(() => { visits++; });
    const values = Array.from({ length: 1000 }, (_, index) => index);
    const result = kind === 'array-max' ? z.array(child).max(2).safeParse(values)
      : kind === 'array-length' ? z.array(child).length(2).safeParse(values)
        : kind === 'set-max' ? z.set(child).max(2).safeParse(new Set(values))
          : z.map(z.number(), child).max(2).safeParse(new Map(values.map(value => [value, value])));
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues).toMatchObject([{ code: 'too_big' }]);
  });

  it('conserva transformaciones dentro de cuota y errores de elementos autorizados', async () => {
    const schema = z.array(z.number().int().transform(value => value * 2)).min(1).max(2);
    expect(schema.parse([1, 2])).toEqual([2, 4]);
    expect(schema.safeParse([]).success).toBe(false);
    const invalid = schema.safeParse([1, 'dato inválido']);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0].path).toEqual([1]);
    expect(await z.array(z.number().transform(async value => value + 1)).max(2).parseAsync([1])).toEqual([2]);
  });

  it('preserva fechas, campos cerrados y refinamientos de los contratos del calendario', () => {
    const event = { title: ' Revisión ', start: '2026-10-24T15:00:00Z', end: '2026-10-24T16:00:00Z' };
    expect(createEventSchema.parse(event)).toEqual({ ...event, title: 'Revisión' });
    expect(createEventSchema.safeParse({ ...event, accessToken: 'dato-ficticio' }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...event, end: event.start }).success).toBe(false);
    expect(updateEventSchema.safeParse({}).success).toBe(false);
    expect(updateEventSchema.safeParse({ start: event.start }).success).toBe(false);
    expect(updateEventSchema.parse({ title: ' Nueva revisión ' })).toEqual({ title: 'Nueva revisión' });
  });
});
