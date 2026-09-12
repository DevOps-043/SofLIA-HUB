import { describe, expect, it } from 'vitest';
import { reconcileBrowserSync, type BrowserSyncMergeInput } from '../integrated-browser/sync-conflicts';
import type { BrowserSyncRecord } from '../integrated-browser/sync-crypto';

const bookmark = (id: string, title = 'Base', rest: object = {}) => ({ id, title, url: 'https://example.com/page', ...rest });
const input = (values: Partial<BrowserSyncMergeInput> = {}): BrowserSyncMergeInput => ({
  category: 'bookmarks', baseRevision: 1, remoteRevision: 2,
  base: [bookmark('b')], local: [bookmark('b')], remote: [bookmark('b')], ...values,
});

describe('Reconciliación de sync de tres vías', () => {
  it('combina campos independientes sin usar el reloj como ganador', () => {
    const result = reconcileBrowserSync(input({
      local: [bookmark('b', 'Nombre local')], remote: [bookmark('b', 'Base', { folderId: 'carpeta' })],
    }));
    expect(result).toMatchObject({ status: 'ready', unresolved: 0, payload: [bookmark('b', 'Nombre local', { folderId: 'carpeta' })] });
  });

  it('conserva ambos valores y no entrega un payload parcial', () => {
    const source = input({ local: [bookmark('b', 'Local')], remote: [bookmark('b', 'Remoto')] });
    const result = reconcileBrowserSync(source);
    expect(result).toMatchObject({ status: 'conflict', payload: null, unresolved: 1 });
    expect(result.conflicts[0]).toMatchObject({ kind: 'field', recordId: 'b', field: 'title', base: { present: true, value: 'Base' }, local: { present: true, value: 'Local' }, remote: { present: true, value: 'Remoto' } });
    const resolved = reconcileBrowserSync(source, [{ conflictId: result.conflicts[0].id, side: 'remote' }]);
    expect(resolved).toMatchObject({ reviewId: result.reviewId, status: 'ready', payload: [bookmark('b', 'Remoto')] });
    expect(resolved.conflicts).toEqual(result.conflicts);
  });

  it.each(['local', 'remote'] as const)('retiene borrado contra edición (%s)', (side) => {
    const source = input(side === 'local' ? { local: [], remote: [bookmark('b', 'Editado')] } : { remote: [], local: [bookmark('b', 'Editado')] });
    const result = reconcileBrowserSync(source);
    expect(result.conflicts[0]).toMatchObject({ kind: 'delete-edit', [side]: { present: false } });
    expect(reconcileBrowserSync(source, [{ conflictId: result.conflicts[0].id, side }]).payload).toEqual([]);
  });

  it('aplica borrados no concurrentes y agrega registros de ambos lados', () => {
    const result = reconcileBrowserSync(input({ local: [], remote: [bookmark('b'), bookmark('r')] }));
    expect(result.payload).toEqual([bookmark('r')]);
    expect(reconcileBrowserSync(input({ base: [], local: [bookmark('l')], remote: [bookmark('r')] })).payload).toEqual([bookmark('l'), bookmark('r')]);
  });

  it('un ID nuevo colisionado no fusiona identidades distintas', () => {
    const result = reconcileBrowserSync(input({ base: [], local: [bookmark('b', 'L')], remote: [bookmark('b', 'R')] }));
    expect(result.conflicts[0]).toMatchObject({ kind: 'id-collision', field: null, base: { present: false } });
  });

  it('trata etiquetas como conjunto y conserva altas/bajas compatibles', () => {
    const result = reconcileBrowserSync(input({
      base: [bookmark('b', 'Base', { tags: ['común', 'quitar'] })],
      local: [bookmark('b', 'Base', { tags: ['común', 'local', 'local'] })],
      remote: [bookmark('b', 'Base', { tags: ['remota', 'quitar', 'común'] })],
    }));
    expect(result.payload).toEqual([bookmark('b', 'Base', { tags: ['común', 'local', 'remota'] })]);
  });

  it('no trunca etiquetas cuando su unión supera la cuota', () => {
    const result = reconcileBrowserSync(input({
      base: [bookmark('b', 'Base', { tags: [] })],
      local: [bookmark('b', 'Base', { tags: Array.from({ length: 11 }, (_, n) => `l${n}`) })],
      remote: [bookmark('b', 'Base', { tags: Array.from({ length: 11 }, (_, n) => `r${n}`) })],
    }));
    expect(result).toMatchObject({ status: 'conflict', payload: null });
    expect(result.conflicts[0]).toMatchObject({ kind: 'field', field: 'tags' });
  });

  it('combina preferencias cerradas y diferencia ausencia de null', () => {
    expect(reconcileBrowserSync(input({ category: 'settings', base: { theme: 'system', tabLayout: 'horizontal' }, local: { theme: 'dark', tabLayout: 'horizontal' }, remote: { theme: 'system', tabLayout: 'vertical' } })).payload).toEqual({ theme: 'dark', tabLayout: 'vertical' });
    const result = reconcileBrowserSync(input({ base: [bookmark('b', 'Base', { folderId: 'antes' })], local: [bookmark('b', 'Base', { folderId: null })], remote: [bookmark('b')] }));
    expect(result.conflicts[0]).toMatchObject({ field: 'folderId', local: { present: true, value: null }, remote: { present: false } });
  });

  it.each(['groups', 'tabs'] as const)('combina metadata y orden de %s', (category) => {
    const row: BrowserSyncRecord = category === 'tabs' ? { id: 't', url: 'https://example.com/', title: 'Base', pinned: false, position: 0 } : { id: 'g', name: 'Base', color: 'blue', collapsed: false, position: 0 };
    const key = category === 'tabs' ? 'title' : 'name';
    expect(reconcileBrowserSync(input({ category, base: [row], local: [{ ...row, [key]: 'Nuevo' }], remote: [{ ...row, position: 2 }] })).payload).toEqual([{ ...row, [key]: 'Nuevo', position: 2 }]);
  });

  it('ordena empates por ID y no depende del orden de objetos/listas o del lado', () => {
    const source = input({ base: [], local: [bookmark('z'), bookmark('a')], remote: [bookmark('é')] });
    const result = reconcileBrowserSync(source);
    expect(result.payload).toEqual([bookmark('a'), bookmark('z'), bookmark('é')]);
    expect(reconcileBrowserSync({ ...source, local: [...source.local as object[]].reverse() }).reviewId).toBe(result.reviewId);
    expect(reconcileBrowserSync({ ...source, local: source.remote, remote: source.local }).payload).toEqual(result.payload);
  });

  it('rechaza selección ajena, duplicada o de una revisión anterior', () => {
    const source = input({ local: [bookmark('b', 'L')], remote: [bookmark('b', 'R')] });
    const conflictId = reconcileBrowserSync(source).conflicts[0].id;
    const choice = { conflictId, side: 'local' as const };
    expect(() => reconcileBrowserSync(source, [choice, choice])).toThrow('inválidas');
    expect(() => reconcileBrowserSync({ ...source, remoteRevision: 3 }, [choice])).toThrow('no pertenece');
    expect(() => reconcileBrowserSync(source, [{ conflictId: 'ajeno', side: 'remote' }])).toThrow('no pertenece');
    expect(() => reconcileBrowserSync(source, [{ ...choice, side: 'base' } as never])).toThrow('inválidas');
    expect(() => reconcileBrowserSync(source, [{ ...choice, password: 'nunca' } as never])).toThrow('inválidas');
  });

  it('sanea URL antes de conservar conflictos y no modifica las entradas', () => {
    const source = input({ local: [bookmark('b', 'L', { url: 'https://example.com/page?session=nunca#token' })], remote: [bookmark('b', 'R')] });
    const before = JSON.stringify(source);
    const result = reconcileBrowserSync(source);
    expect(JSON.stringify(result)).not.toContain('nunca');
    expect(JSON.stringify(source)).toBe(before);
    result.conflicts[0].local = { present: true, value: 'mutado' };
    expect(reconcileBrowserSync(source).conflicts[0].local).toEqual({ present: true, value: 'L' });
  });

  it.each([
    { base: null }, { remoteRevision: 1 }, { baseRevision: -1 }, { remoteRevision: Number.MAX_SAFE_INTEGER + 1 },
    { category: 'passwords' }, { local: [bookmark('b'), bookmark('b')] },
    { remote: [bookmark('b', 'R', { password: 'nunca' })] }, { local: [bookmark('b', 'L', { unknown: true })] },
  ])('rechaza entrada inválida %#', (invalid) => {
    expect(() => reconcileBrowserSync({ ...input(), ...invalid })).toThrow();
  });

  it('conserva categoría completa si la unión excede 10000 registros', () => {
    const source = input({ base: [], local: Array.from({ length: 5001 }, (_, n) => bookmark(`l${n}`)), remote: Array.from({ length: 5000 }, (_, n) => bookmark(`r${n}`)) });
    const result = reconcileBrowserSync(source);
    expect(result).toMatchObject({ status: 'conflict', payload: null, unresolved: 1 });
    expect(result.conflicts[0]).toMatchObject({ kind: 'quota', recordId: null, field: null });
    expect(reconcileBrowserSync(source, [{ conflictId: result.conflicts[0].id, side: 'local' }]).payload).toHaveLength(5001);
  });

  it('rechaza más de 2 MiB por instantánea antes de reconciliar', () => {
    const large = Array.from({ length: 5000 }, (_, n) => bookmark(String(n), 'x'.repeat(500)));
    expect(() => reconcileBrowserSync(input({ local: large }))).toThrow('2 MB');
  });
});
