import { describe, expect, it, vi } from 'vitest';
import { projectHubInputs, projectHubSnapshot, PROJECT_HUB_IPC_MAX_BYTES, PROJECT_HUB_IPC_MAX_NODES } from '../../src/shared/project-hub';
import { projectHubIpcCases, IPC_ID } from './project-hub/ipc-cases';
import { projectHubMutationReview } from '../project-hub/ipc-review';

const operations = projectHubIpcCases.filter(item => item.input !== undefined);
describe('Contratos de entrada Project Hub', () => {
  it.each(operations)('acepta el payload del consumidor de $method', item => {
    const method = item.method as keyof typeof projectHubInputs;
    expect(projectHubInputs[method].safeParse(projectHubSnapshot(item.input)).success).toBe(true);
  });
  it.each(operations)('rechaza un campo de autoridad ajeno en $method', item => {
    const method = item.method as keyof typeof projectHubInputs;
    expect(projectHubInputs[method].safeParse({ ...item.input, authenticated: true }).success).toBe(false);
  });
  it.each([
    { workspaceId: IPC_ID, project: { name: '' } },
    { workspaceId: IPC_ID, project: { name: 'x', start_date: '2026-10-22', target_date: '2026-10-21' } },
    { workspaceId: IPC_ID, project: { name: 'x', tags: Array(26).fill('etiqueta') } },
    { workspaceId: IPC_ID, project: { name: 'x', lead_user_id: 'no-uuid' } },
  ])('rechaza un proyecto fuera de contrato: %#', input => {
    expect(projectHubInputs.createProject.safeParse(input).success).toBe(false);
  });
  it('rechaza updates vacíos y evidencia añadida por update de tarea', () => {
    const target = { workspaceId: IPC_ID, projectId: IPC_ID };
    expect(projectHubInputs.updateProject.safeParse({ ...target, updates: {} }).success).toBe(false);
    expect(projectHubInputs.updateTask.safeParse({ ...target, taskId: IPC_ID, updates: { evidence_id: IPC_ID } }).success).toBe(false);
  });
  it('valida modo, aprobación, referencias y clave de importación', () => {
    const valid = structuredClone(projectHubIpcCases.find(item => item.method === 'importMeeting')!.input!);
    expect(projectHubInputs.importMeeting.safeParse({ ...valid, meeting: { ...valid.meeting, approved: false } }).success).toBe(false);
    expect(projectHubInputs.importMeeting.safeParse({ ...valid, meeting: { ...valid.meeting, tasks: [{ mode: 'link' }] } }).success).toBe(false);
    expect(projectHubInputs.importMeeting.safeParse({ ...valid, idempotencyKey: 'clave\r\ninyectada' }).success).toBe(false);
  });
  it('no permite un esquema ejecutable ni credenciales en una URL de pestaña', () => {
    const valid = projectHubIpcCases.find(item => item.method === 'createBrowserCollection')!.input!;
    for (const source_url of ['no-url', 'javascript:alert(1)', 'file:///prueba', 'https://usuario:clave@example.test']) {
      expect(projectHubInputs.createBrowserCollection.safeParse({ ...valid, collection: { ...valid.collection, tabs: [{ type: 'tab', position: 0, source_url }] } }).success).toBe(false);
    }
  });
});

describe('Snapshot JSON Project Hub acotado', () => {
  it('copia profundo, conserva null y elimina sólo undefined de propiedades JSON', () => {
    const original = { metadata: { valores: [null, true, 1, 'texto'] }, optional: undefined };
    const copy = projectHubSnapshot(original); original.metadata.valores.push('cambio');
    expect(copy).toEqual({ metadata: { valores: [null, true, 1, 'texto'] } });
  });
  it.each([NaN, Infinity, 1n, () => {}, new Date(), new Uint8Array([1]), [undefined]])('rechaza valores fuera de JSON: %#', input => {
    expect(() => projectHubSnapshot(input)).toThrow();
  });
  it('no ejecuta getters ni acepta claves de prototipo', () => {
    const getter = vi.fn(() => 'no-ejecutar'); const input = {};
    Object.defineProperty(input, 'secreto', { enumerable: true, get: getter });
    expect(() => projectHubSnapshot(input)).toThrow(); expect(getter).not.toHaveBeenCalled();
    expect(() => projectHubSnapshot(JSON.parse('{"__proto__":{"admin":true}}'))).toThrow();
    expect(Object.prototype).not.toHaveProperty('admin');
  });
  it('limita bytes reales multibyte, profundidad, nodos y ciclos antes de Zod', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    let deep: unknown = {}; for (let index = 0; index < 14; index++) deep = { nested: deep };
    for (const value of [cyclic, deep, 'á'.repeat(PROJECT_HUB_IPC_MAX_BYTES / 2 + 1), Array(PROJECT_HUB_IPC_MAX_NODES + 1).fill(0)]) {
      expect(() => projectHubSnapshot(value)).toThrow();
    }
  });
  it('presenta usuario/destino y avisa que comparte textos/listas completos', () => {
    const input = { workspaceId: IPC_ID, projectId: IPC_ID, collection: { name: 'Investigación', tabs: Array(50).fill({ content: 'x'.repeat(51_200) }) } };
    const review = projectHubMutationReview('Compartir investigación', 'usuario-ficticio', input);
    expect(review).toContain(IPC_ID); expect(review).toContain('usuario-ficticio'); expect(review).toContain('51200');
    expect(review).toContain('todos los elementos'); expect(review.length).toBeLessThan(13_000);
  });
});
