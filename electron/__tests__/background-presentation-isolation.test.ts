import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackgroundTeamService } from '../background-teams/service';
import { BackgroundRepository } from '../background-teams/repository';
import { WorkspaceBackgroundPresentation } from '../background-teams/presentation-workspace';
import { SkillWorkspaceService } from '../skill-workspace/service';
import type { BackgroundProvider, ExecutorInput } from '../background-teams/contracts';
import type { BackgroundScope, BackgroundStart } from '../../src/shared/background-teams';
import { PRESENTACIONES_SKILL } from '../../src/shared/skills/presentaciones-skill';

const roots: string[] = [];
const services: BackgroundTeamService[] = [];
afterEach(async () => {
  services.splice(0).forEach(service => service.close());
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
const deck = {
  version: 1, meta: { titulo: 'Calidad y normalización de software', direccionVisual: 'Editorial técnico y sobrio' },
  slides: [
    { id: 'inicio', tipo: 'portada', variante: 'visual-dominante', titulo: 'Calidad de software', movimiento: { continuidad: 'flujo', entrada: 'revelado', enfasis: 'ninguno' } },
    { id: 'criterios', tipo: 'declaracion', variante: 'inmersiva', titulo: 'Acordar criterios verificables', texto: 'Relacionar requisitos, evidencia y revisión del producto.', movimiento: { continuidad: 'zoom', entrada: 'foco', enfasis: 'ninguno' } },
    { id: 'cierre', tipo: 'cierre', variante: 'editorial', titulo: 'Verificación continua', accion: 'Definir criterios verificables', movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'ninguno' } },
  ],
};
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-chat-isolation-')); roots.push(root);
  const workspace = new SkillWorkspaceService(path.join(root, 'workspaces'));
  const created = await workspace.createWorkspace({ skillId: PRESENTACIONES_SKILL.id, title: 'Calidad de software', conversationId: 'chat-presentacion', policy: PRESENTACIONES_SKILL.workspace!, owner: { userId: 'usuario', dataUserId: 'datos', organizationId: null } });
  if (!created.ok) throw new Error(created.error);
  const scope: BackgroundScope = { userId: 'usuario', dataUserId: 'datos', organizationId: null };
  const repository = new BackgroundRepository(path.join(root, 'jobs'), { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value), decryptString: value => value.toString() });
  const authorize = vi.fn(async () => {});
  const presentation = new WorkspaceBackgroundPresentation(() => workspace);
  const request: BackgroundStart = { requestId: randomUUID(), messageId: randomUUID(), conversationId: 'chat-presentacion', task: 'Crea una presentación sobre calidad y normalización de software', source: 'Usa el tema indicado; no inventes normas ni cifras.', model: 'gpt-6-luna', effort: 'medium', allowResearch: false, expectedOwnerId: scope.userId, expectedOrganizationId: null, presentationWorkspaceId: created.data.id };
  const makeService = (provider: BackgroundProvider) => {
    const service = new BackgroundTeamService({ repository, presentation, authorize, resolveScope: async () => scope, provider: async () => provider });
    services.push(service); return service;
  };
  return { workspace, repository, scope, id: created.data.id, request, presentation, authorize, makeService };
}
async function writeAgent(input: ExecutorInput, coordinator?: () => Promise<void>, presentationDeck: unknown = deck) {
  await input.beforeCall();
  if (input.agent.role === 'coordinador') {
    await coordinator?.();
    const outputs = JSON.parse(await input.callTool('read_outputs', {}));
    for (const artifact of outputs.archivos) await input.callTool('read_artifact', { artifactId: artifact.id });
    await input.callTool('workspace_write_file', { path: 'guion.md', content: '# Calidad de software\n\nCriterios verificables y mejora continua.' });
    const written = JSON.parse(await input.callTool('workspace_write_file', { path: 'deck.json', content: JSON.stringify(presentationDeck) }));
    if (written.success === false) throw new Error(written.error);
    await input.callTool('workspace_read_file', { path: 'deck.json' });
  }
  await input.callTool('write_artifact', { name: input.agent.role + '.md', title: 'Aporte', content: '# Calidad de software\n\nContenido elaborado para el chat de presentación.' });
  return 'Preparé la presentación sobre calidad de software.';
}

describe('presentaciones main aisladas por chat', () => {
  it('reanuda tras reiniciar main conservando origen, workspace y aportes ya comprobados', async () => {
    const setup = await fixture();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const first = setup.makeService({ execute: input => writeAgent(input, () => pending), research: vi.fn() });
    await first.context(null); const job = await first.start(setup.request);
    await vi.waitFor(() => expect(first.state().jobs[0].agents[2].status).toBe('running'));
    first.close(); release(); await first.idle();
    const execute = vi.fn((input: ExecutorInput) => writeAgent(input));
    const next = setup.makeService({ execute, research: vi.fn() });
    expect((await next.context(null)).jobs[0].status).toBe('interrupted');
    await next.control(job.id, 'resume'); await next.idle();
    expect(next.state().jobs[0]).toMatchObject({ id: job.id, conversationId: setup.request.conversationId, presentationWorkspaceId: setup.id, status: 'completed' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].agent.role).toBe('coordinador');
    expect(next.state().jobs[0].artifacts.some(file => file.format === 'pptx' && file.verified)).toBe(true);
  });

  it('cancela el ámbito anterior antes de esperar la autorización de otra organización', async () => {
    const setup = await fixture();
    let resolveScope!: (scope: BackgroundScope) => void;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let signal: AbortSignal | undefined;
    const service = new BackgroundTeamService({ repository: setup.repository, presentation: setup.presentation, authorize: setup.authorize,
      resolveScope: async organizationId => organizationId === null ? setup.scope : new Promise(resolve => { resolveScope = resolve; }),
      provider: async () => ({ research: vi.fn(), execute: input => { signal = input.signal; return writeAgent(input, () => pending); } }) });
    services.push(service);
    await service.context(null); await service.start(setup.request);
    await vi.waitFor(() => expect(service.state().jobs[0].agents[2].status).toBe('running'));
    const changing = service.context('11111111-1111-4111-8111-111111111111');
    expect(signal?.aborted).toBe(true);
    release(); await service.idle();
    expect((await setup.workspace.readFile(setup.id, 'deck.json')).ok).toBe(false);
    resolveScope({ ...setup.scope, organizationId: '11111111-1111-4111-8111-111111111111' });
    await changing;
  });

  it.each([false, true])('conserva imágenes generadas en el origen y descarta la respuesta tras cancelar=%s', async cancel => {
    const setup = await fixture();
    const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#00acac' } }).png().toBuffer();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let signal: AbortSignal | undefined;
    const generateImage = vi.fn(async (_prompt: string, jobSignal: AbortSignal) => {
      signal = jobSignal; await pending;
      return { dataUrl: 'data:image/png;base64,' + image.toString('base64'), tokens: 12 };
    });
    const service = setup.makeService({ generateImage, research: vi.fn(), execute: async input => {
      if (input.agent.role === 'coordinador') {
        expect(input.tools.some(tool => tool.name === 'workspace_generate_image')).toBe(true);
        const result = JSON.parse(await input.callTool('workspace_generate_image', { prompt: 'Ilustración conceptual de calidad', file_name: 'calidad.png' }));
        expect(result.archivo.path).toBe('assets/calidad.png');
        const observed = JSON.parse(await input.callTool('workspace_read_image', { path: 'assets/calidad.png' }));
        expect(observed.imageDataUrl).toBe('data:image/png;base64,' + image.toString('base64'));
      }
      return writeAgent(input);
    } });
    await service.context(null); const job = await service.start(setup.request);
    await vi.waitFor(() => expect(generateImage).toHaveBeenCalledTimes(1));
    await service.context(null);
    if (cancel) await service.control(job.id, 'cancel');
    release(); await service.idle();
    expect(signal?.aborted).toBe(cancel);
    expect(await setup.workspace.resolveAbsolutePath(setup.id, 'assets/calidad.png')).toEqual(cancel ? null : expect.any(String));
    expect(service.state().jobs[0].status).toBe(cancel ? 'cancelled' : 'completed');
    expect(await setup.workspace.findByConversation('apoyo-emocional')).toBeNull();
  });

  it('una solicitud anterior no sustituye la última selección de organización aunque termine primero', async () => {
    const setup = await fixture();
    let older!: (scope: BackgroundScope) => void;
    let newer!: (scope: BackgroundScope) => void;
    const service = new BackgroundTeamService({ repository: setup.repository, authorize: setup.authorize, provider: async () => ({ execute: input => writeAgent(input), research: vi.fn() }),
      resolveScope: organizationId => new Promise(resolve => { if (organizationId === 'anterior') older = resolve; else newer = resolve; }) });
    services.push(service);
    const old = service.context('anterior');
    const refused = expect(old).rejects.toThrow();
    const latest = service.context(null);
    older({ ...setup.scope, organizationId: '11111111-1111-4111-8111-111111111111' }); await refused;
    newer(setup.scope); await latest;
    expect(service.state().scope.organizationId).toBeNull();
  });

  it('verifica una presentación con imagen real de más de 2 MB dentro del límite del visor', async () => {
    const setup = await fixture();
    const image = await sharp(randomBytes(1024 * 1024 * 3), { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
    expect((await setup.workspace.writeImage(setup.id, 'fuente.png', image)).ok).toBe(true);
    const imageDeck = { ...deck, slides: [{ ...deck.slides[0], imagen: { src: 'assets/fuente.png', alt: 'Referencia sintética de prueba' } }, ...deck.slides.slice(1)] };
    const service = setup.makeService({ execute: input => writeAgent(input, undefined, imageDeck), research: vi.fn() });
    await service.context(null); await service.start(setup.request); await service.idle();
    const result = service.state().jobs[0];
    expect(result.status).toBe('completed');
    expect(result.artifacts.find(file => file.format === 'pptx')?.bytes).toBeGreaterThan(2_000_000);
  });
  it.each(['usuario-ajeno', 'organizacion-ajena'] as const)('rechaza un workspace de %s aunque coincida conversationId', async kind => {
    const setup = await fixture();
    const created = await setup.workspace.createWorkspace({ skillId: PRESENTACIONES_SKILL.id, title: 'Ajeno', conversationId: setup.request.conversationId,
      policy: PRESENTACIONES_SKILL.workspace!, owner: { userId: kind === 'usuario-ajeno' ? 'otro' : 'usuario', dataUserId: 'datos', organizationId: kind === 'organizacion-ajena' ? '11111111-1111-4111-8111-111111111111' : null } });
    if (!created.ok) throw new Error(created.error);
    const execute = vi.fn((input: ExecutorInput) => writeAgent(input));
    const service = setup.makeService({ execute, research: vi.fn() });
    await service.context(null);
    await expect(service.start({ ...setup.request, presentationWorkspaceId: created.data.id })).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
    expect(service.state().jobs).toEqual([]);
  });

  it('no publica un archivo si pierde la reserva durante la escritura atómica', async () => {
    const setup = await fixture();
    await setup.workspace.reserveBackground(setup.id, 'trabajo', 'chat-presentacion', { userId: 'usuario', dataUserId: 'datos', organizationId: null });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let checks = 0;
    const writing = setup.workspace.writeBackgroundFile(setup.id, 'trabajo', 'guion.md', 'No debe publicarse', async () => { if (++checks === 3) await pending; });
    await vi.waitFor(() => expect(checks).toBe(3));
    setup.workspace.releaseBackground(setup.id, 'trabajo'); release();
    expect((await writing).ok).toBe(false);
    expect((await setup.workspace.readFile(setup.id, 'guion.md')).ok).toBe(false);
  });

  it('continúa al consultar otro chat y entrega deck y PowerPoint comprobados sólo en el origen', async () => {
    const setup = await fixture();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const execute = vi.fn((input: ExecutorInput) => writeAgent(input, () => pending));
    const service = setup.makeService({ execute, research: vi.fn() });
    await service.context(null);
    const job = await service.start(setup.request);
    await vi.waitFor(() => expect(service.state().jobs[0].agents[2].status).toBe('running'));
    // La vista del chat sólo consulta estado; no es propietaria del trabajo main.
    expect((await service.context(null)).jobs[0].id).toBe(job.id);
    const elsewhere = await setup.workspace.findByConversation('apoyo-emocional');
    expect(elsewhere).toBeNull();
    expect((await setup.workspace.writeFile(setup.id, 'guion.md', 'Otro chat')).ok).toBe(false);
    await expect(service.start({ ...setup.request, requestId: randomUUID(), messageId: randomUUID() })).rejects.toThrow();
    release(); await service.idle();
    const result = service.state().jobs[0];
    expect(result).toMatchObject({ status: 'completed', conversationId: 'chat-presentacion', messageId: setup.request.messageId, presentationWorkspaceId: setup.id });
    expect(result.artifacts.some(file => file.format === 'pptx' && file.verified)).toBe(true);
    expect((await setup.workspace.getState(setup.id)).ok).toBe(true);
    const source = await setup.workspace.readFile(setup.id, 'deck.json');
    expect(source.ok && JSON.parse(source.data).meta.titulo).toBe(deck.meta.titulo);
    expect(await setup.workspace.findByConversation('apoyo-emocional')).toBeNull();
  });

  it('rechaza workspace de otra conversación y una admisión reutilizada con otro origen', async () => {
    const setup = await fixture();
    const service = setup.makeService({ execute: input => writeAgent(input), research: vi.fn() });
    await service.context(null);
    await expect(service.start({ ...setup.request, conversationId: 'apoyo-emocional' })).rejects.toThrow();
    const admitted = await service.start(setup.request);
    await expect(service.start({ ...setup.request, conversationId: 'otro-chat' })).rejects.toThrow();
    expect((await service.start(setup.request)).id).toBe(admitted.id);
    await service.idle();
    expect(service.state().jobs).toHaveLength(1);
  });

  it.each(['cancel', 'session'] as const)('descarta la escritura tardía después de %s', async action => {
    const setup = await fixture();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const service = setup.makeService({ execute: input => writeAgent(input, () => pending), research: vi.fn() });
    await service.context(null); const job = await service.start(setup.request);
    await vi.waitFor(() => expect(service.state().jobs[0].agents[2].status).toBe('running'));
    if (action === 'cancel') await service.control(job.id, 'cancel');
    else service.invalidate();
    release(); await service.idle();
    expect((await setup.workspace.readFile(setup.id, 'deck.json')).ok).toBe(false);
    expect((await setup.workspace.writeFile(setup.id, 'guion.md', 'Edición tras detener')).ok).toBe(true);
    if (action === 'cancel') expect(service.state().jobs[0].status).toBe('cancelled');
  });

  it('preserva modo directo sin atribuir trabajo a especialistas omitidos', async () => {
    const setup = await fixture();
    const execute = vi.fn((input: ExecutorInput) => writeAgent(input));
    const service = setup.makeService({ execute, research: vi.fn() });
    await service.context(null); await service.start({ ...setup.request, executionMode: 'direct' }); await service.idle();
    expect(service.state().jobs[0].status).toBe('completed');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(service.state().jobs[0].agents.slice(0, 2).every(agent => agent.status === 'skipped')).toBe(true);
  });

  it('falla sin declarar éxito cuando el coordinador no materializa deck.json', async () => {
    const setup = await fixture();
    const service = setup.makeService({ execute: async input => {
      await input.beforeCall();
      if (input.agent.role === 'coordinador') {
        const outputs = JSON.parse(await input.callTool('read_outputs', {}));
        for (const file of outputs.archivos) await input.callTool('read_artifact', { artifactId: file.id });
      }
      await input.callTool('write_artifact', { name: input.agent.role + '.md', title: 'Aporte', content: 'Archivo sin presentación' });
      return 'Todavía no hay deck.';
    }, research: vi.fn() });
    await service.context(null); await service.start(setup.request); await service.idle();
    expect(service.state().jobs[0]).toMatchObject({ status: 'failed' });
    expect(service.state().jobs[0].artifacts.some(file => file.format === 'pptx')).toBe(false);
  });
});
