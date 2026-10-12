import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BackgroundRepository } from '../background-teams/repository';
import { BackgroundTeamService } from '../background-teams/service';
import { ArtifactStore } from '../background-teams/artifacts';
import type { BackgroundProvider, ExecutorInput } from '../background-teams/contracts';
import type { BackgroundJob, BackgroundScope, BackgroundStart } from '../../src/shared/background-teams';
import { BACKGROUND_LIMITS, wantsBackgroundTeam } from '../../src/shared/background-teams';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const scope: BackgroundScope = { userId: 'usuario-sofia', organizationId: null, dataUserId: 'usuario-lia' };
function fixture(provider?: BackgroundProvider) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-background-')); roots.push(root);
  const repository = new BackgroundRepository(root, { isEncryptionAvailable: () => true, encryptString: value => Buffer.from('cifrado:' + value), decryptString: value => value.toString().slice(8) });
  const authorize = vi.fn(async () => {});
  const service = new BackgroundTeamService({ repository, resolveScope: async organizationId => ({ ...scope, organizationId }), authorize,
    provider: async () => provider ?? writerProvider() });
  return { root, repository, service, authorize };
}
const request = (): BackgroundStart => ({ requestId: randomUUID(), messageId: randomUUID(), conversationId: 'chat-origen', task: 'Usa multiagentes para proponer dos activaciones diferentes.', source: 'Rethink & Delight', model: 'gemini-3.8-flash', effort: 'medium', allowResearch: false, expectedOwnerId: scope.userId, expectedOrganizationId: null });
function writerProvider(): BackgroundProvider {
  return {
    execute: vi.fn(async (input: ExecutorInput) => {
      await input.beforeCall(); input.usage(25);
      if (input.agent.role === 'coordinador') {
        const outputs = JSON.parse(await input.callTool('read_outputs', {}));
        for (const file of outputs.archivos) await input.callTool('read_artifact', { artifactId: file.id });
      }
      const result = JSON.parse(await input.callTool('write_artifact', { name: input.agent.role + '.md', title: 'Aporte', content: '# Propuesta\n\nArchivo creado por ' + input.agent.role }));
      if (!result.id) throw new Error('No se creó el archivo.');
      return 'Entregable preparado.';
    }),
    research: vi.fn(async () => ({ text: 'Referencia', tokens: 10 })),
  };
}
describe('Equipos ejecutores en main', () => {
  it('permite corregir una postcondición pendiente reejecutando el coordinador', async () => {
    const normal = writerProvider(); let skipReads = true;
    const provider: BackgroundProvider = { research: normal.research, execute: async input => {
      if (input.agent.role === 'coordinador' && skipReads) {
        await input.beforeCall(); await input.callTool('write_artifact', { name: 'final.md', title: 'Final', content: 'Pendiente de revisión' }); return 'Creado';
      }
      return normal.execute(input);
    } };
    const { service } = fixture(provider); await service.context(null); const job = await service.start(request()); await service.idle();
    expect(service.state().jobs[0].status).toBe('failed'); expect(service.state().jobs[0].agents[2].status).toBe('pending');
    skipReads = false; await service.control(job.id, 'resume'); await service.idle();
    expect(service.state().jobs[0].status).toBe('completed'); service.close();
  });
  it('vincula un borrador legado solo después de verificar su mensaje de origen', async () => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    const stored = service.state().jobs[0]; stored.conversationId = 'borrador:' + randomUUID(); delete stored.messageId;
    service.close(); repository.save(scope, [stored]);
    const verify = vi.fn(async () => {});
    const next = new BackgroundTeamService({ repository, resolveScope: async () => scope, authorize: async () => {}, provider: async () => writerProvider(), verifyLegacyBinding: verify });
    await next.context(null);
    const binding = { jobId: stored.id, messageId: randomUUID(), conversationId: randomUUID() };
    await next.attachLegacy(binding);
    expect(verify).toHaveBeenCalledOnce(); expect(next.state().jobs[0].messageId).toBe(binding.messageId);
    await expect(next.attachLegacy({ ...binding, messageId: randomUUID() })).rejects.toThrow();
    next.close();
  });
  it('muestra tiempo activo real mientras el proveedor está trabajando', async () => {
    let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    const { service } = fixture({ execute: async input => { await waiting; await input.beforeCall(); return ''; }, research: async () => ({ text: '', tokens: 0 }) });
    await service.context(null); const job = await service.start(request());
    await vi.waitFor(() => expect(service.state().jobs[0].agents[0].status).toBe('running'));
    const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 2000);
    expect(service.state().jobs[0].activeMs).toBeGreaterThanOrEqual(2000);
    clock.mockRestore(); await service.control(job.id, 'cancel'); release(); await service.idle(); service.close();
  });
  it('canonicaliza el alcance aunque sus propiedades lleguen en otro orden', async () => {
    const { repository } = fixture();
    const reordered = { userId: scope.userId, dataUserId: scope.dataUserId, organizationId: scope.organizationId };
    const service = new BackgroundTeamService({ repository, resolveScope: async () => reordered, authorize: async () => {}, provider: async () => writerProvider() });
    await service.context(null); await service.start(request()); await service.idle();
    expect(service.state().jobs[0].status).toBe('completed');
    expect(repository.load(scope)[0].status).toBe('completed');
    expect(repository.load(reordered)[0].id).toBe(repository.load(scope)[0].id);
    service.close();
  });
  it('no admite un encargo bajo otra organización entre context y start', async () => {
    const { service } = fixture();
    await service.context('4bc25420-46e1-4a93-9886-faf34152758a');
    await expect(service.start(request())).rejects.toThrow('contexto del encargo');
    expect(service.state().jobs).toHaveLength(0); service.close();
  });
  it('rechaza reanudación si el contexto cambia mientras se drena la ejecución', async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const { service } = fixture({ execute: async input => { await wait; await input.beforeCall(); return ''; }, research: async () => ({ text: '', tokens: 0 }) });
    await service.context(null); const job = await service.start(request());
    await vi.waitFor(() => expect(service.state().jobs[0].agents[0].status).toBe('running'));
    await service.control(job.id, 'pause');
    const attempt = service.control(job.id, 'resume'); const failed = expect(attempt).rejects.toThrow();
    await service.context('4bc25420-46e1-4a93-9886-faf34152758a');
    release(); await failed; await service.idle();
    expect(service.state().jobs).toHaveLength(0); service.close();
  });
  it('no completa un informe solicitado cuando solo produjo Markdown', async () => {
    const { service } = fixture(); await service.context(null);
    await service.start({ ...request(), task: 'Usa multiagentes para crear un informe sobre activaciones' }); await service.idle();
    expect(service.state().jobs[0].status).toBe('failed'); service.close();
  });
  it('no declara investigación verificada sin fuentes observadas y citadas', async () => {
    const { service } = fixture(); await service.context(null);
    await service.start({ ...request(), task: 'Investiga tres referencias verificables y crea un dossier Markdown con enlaces', allowResearch: true });
    await service.idle(); expect(service.state().jobs[0].status).toBe('failed'); service.close();
  });
  it('impide completar y ejecutar nuevas acciones después de superar tokens', async () => {
    const normal = writerProvider();
    const { service } = fixture({ execute: async input => {
      if (input.agent.role === 'coordinador') input.usage(BACKGROUND_LIMITS.tokens + 1);
      return normal.execute(input);
    }, research: normal.research });
    await service.context(null); await service.start(request()); await service.idle();
    expect(service.state().jobs[0].status).toBe('failed');
    expect(service.state().jobs[0].artifacts).toHaveLength(2); service.close();
  });
  it('admite inmediatamente, ejecuta dos trabajadores y coordina archivos reales', async () => {
    const { service, repository } = fixture(); await service.context(null);
    const input = request(); const job = await service.start(input);
    expect(job.conversationId).toBe('chat-origen');
    expect((await service.start(input)).id).toBe(job.id);
    await service.idle();
    const finished = service.state().jobs[0];
    expect(finished.status).toBe('completed');
    expect(finished.artifacts).toHaveLength(3);
    expect(finished.artifacts.every(file => file.verified)).toBe(true);
    expect(finished.agents.map(agent => agent.status)).toEqual(['completed', 'completed', 'completed']);
    expect(finished.calls).toBe(3);
    expect(repository.load(scope)[0].status).toBe('completed');
    const file = await service.artifactFile(job.id, finished.artifacts[0].id);
    expect(fs.readFileSync(file, 'utf8')).toContain('Archivo creado');
    service.close();
  });
  it('no completa un agente que responde sin ejecutar herramientas', async () => {
    const { service } = fixture({ execute: async () => 'Ya guardé todo.', research: async () => ({ text: '', tokens: 0 }) });
    await service.context(null); await service.start(request()); await service.idle();
    expect(service.state().jobs[0].status).toBe('failed');
    expect(service.state().jobs[0].artifacts).toHaveLength(0);
    service.close();
  });
  it('cancela trabajo bloqueado y rechaza una herramienta tardía', async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const toolResults: unknown[] = [];
    const { service } = fixture({ execute: async input => {
      await waiting;
      try { toolResults.push(await input.callTool('write_artifact', { name: 'tarde.md', title: 'Tarde', content: 'No debe crearse' })); } catch { toolResults.push('denegado'); }
      return '';
    }, research: async () => ({ text: '', tokens: 0 }) });
    await service.context(null); const job = await service.start(request());
    await vi.waitFor(() => expect(service.state().jobs[0].agents[0].status).toBe('running'));
    await service.control(job.id, 'cancel'); release(); await service.idle();
    expect(toolResults).toEqual(['denegado', 'denegado']);
    expect(service.state().jobs[0].status).toBe('cancelled');
    expect(service.state().jobs[0].artifacts).toHaveLength(0);
    service.close();
  });
  it('recupera un punto de control y reutiliza el especialista completado', async () => {
    const provider = writerProvider(); const { service, repository } = fixture(provider);
    await service.context(null); const job = await service.start(request()); await service.idle();
    const stored = service.state().jobs[0];
    stored.status = 'running'; stored.agents[1].status = 'running'; stored.agents[2].status = 'pending';
    stored.artifacts = stored.artifacts.filter(file => file.role === 'especialista-uno');
    service.close(); repository.save(scope, [stored]);
    const next = new BackgroundTeamService({ repository, resolveScope: async () => scope, authorize: async () => {}, provider: async () => provider });
    expect((await next.context(null)).jobs[0].status).toBe('interrupted');
    vi.mocked(provider.execute).mockClear();
    await next.control(job.id, 'resume'); await next.idle();
    expect(next.state().jobs[0].status).toBe('completed');
    expect(vi.mocked(provider.execute).mock.calls.map(call => call[0].agent.role)).toEqual(['especialista-dos', 'coordinador']);
    next.close();
  });
  it('pausa y reanuda sin que el cierre tardío sobrescriba el estado', async () => {
    let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    let block = true; const writer = writerProvider();
    const { service } = fixture({ execute: async input => { if (block) await waiting; return writer.execute(input); }, research: writer.research });
    await service.context(null); const job = await service.start(request());
    await vi.waitFor(() => expect(service.state().jobs[0].agents[0].status).toBe('running'));
    await service.control(job.id, 'pause');
    const resumed = service.control(job.id, 'resume'); block = false; release();
    await resumed; await service.idle();
    expect(service.state().jobs[0].status).toBe('completed'); service.close();
  });
  it('no entrega archivos fuera del trabajo y detecta ediciones posteriores', async () => {
    const { service } = fixture(); await service.context(null); const job = await service.start(request()); await service.idle();
    await expect(service.artifactFile(job.id, randomUUID())).rejects.toThrow();
    const artifact = service.state().jobs[0].artifacts[0];
    const file = await service.artifactFile(job.id, artifact.id); fs.writeFileSync(file, 'Cambio del usuario');
    await expect(service.artifactFile(job.id, artifact.id)).rejects.toThrow('cambió');
    service.close();
  });
  it('invalida la sesión activa y guarda el trabajo como interrumpido', async () => {
    let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
    const { service, repository } = fixture({ execute: async input => { await wait; await input.beforeCall(); return ''; }, research: async () => ({ text: '', tokens: 0 }) });
    await service.context(null); await service.start(request());
    await vi.waitFor(() => expect(service.state().jobs[0].status).toBe('running'));
    service.invalidate(); release(); await service.idle();
    expect(() => service.state()).toThrow(); expect(repository.load(scope)[0].status).toBe('interrupted');
    service.close();
  });
  it('niega investigación cuando el encargo está limitado a fuentes aportadas', async () => {
    const provider = writerProvider();
    const normal = provider.execute;
    provider.execute = async input => {
      expect(input.tools.map(tool => tool.name)).not.toContain('research_web');
      await expect(input.callTool('research_web', { query: 'algo externo' })).rejects.toThrow('autorizada');
      return normal(input);
    };
    const { service } = fixture(provider); await service.context(null); await service.start(request()); await service.idle();
    expect(provider.research).not.toHaveBeenCalled(); service.close();
  });
  it('rechaza almacenamiento sin cifrado y parámetros no autorizados', async () => {
    const { root } = fixture();
    const repository = new BackgroundRepository(root, { isEncryptionAvailable: () => false, encryptString: value => Buffer.from(value), decryptString: value => value.toString() });
    expect(() => repository.load(scope)).toThrow('cifrado');
    const { service } = fixture(); await service.context(null);
    await expect(service.start({ ...request(), model: 'modelo-arbitrario' })).rejects.toThrow();
    expect(service.state().jobs).toHaveLength(0); service.close();
  });
  it('no admite una nueva llamada al superar el presupuesto', async () => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    const stored = service.state().jobs[0]; stored.status = 'paused'; stored.calls = BACKGROUND_LIMITS.calls;
    service.close(); repository.save(scope, [stored]);
    const next = new BackgroundTeamService({ repository, resolveScope: async () => scope, authorize: async () => {}, provider: async () => writerProvider() });
    await next.context(null); await expect(next.control(stored.id, 'resume')).rejects.toThrow('presupuesto'); next.close();
  });
});
describe('Archivos de equipos ejecutores', () => {
  it('crea Word, PowerPoint y Excel con fórmulas y los abre para comprobarlos', async () => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    const stored = service.state().jobs[0]; const artifacts = new ArtifactStore(repository); const guard = async () => {};
    const word = await artifacts.create(stored, 'coordinador', 'text', { name: 'informe.docx', title: 'Informe', content: 'Contenido real comprobable' }, guard);
    expect(await artifacts.read(stored, word)).toContain('Contenido real');
    const ppt = await artifacts.create(stored, 'coordinador', 'slides', { name: 'activaciones.pptx', slides: [{ title: 'Rethink', body: 'Una activación real' }] }, guard);
    expect(await artifacts.read(stored, ppt)).toContain('Una activación real');
    const sheet = await artifacts.create(stored, 'coordinador', 'sheet', { name: 'costes.xlsx', headers: ['Concepto', 'Coste'], rows: [['Material', 10], ['Montaje', 20]], totalColumns: [1] }, guard);
    const content = await artifacts.read(stored, sheet);
    expect(content).toContain('SUM(B2:B3)'); expect(content).toContain('30');
    service.close();
  });
  it('rechaza escapes de ruta y fórmulas inyectadas por CSV', async () => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    const job: BackgroundJob = service.state().jobs[0]; const store = new ArtifactStore(repository);
    await expect(store.create(job, 'coordinador', 'text', { name: '../fuera.md', title: 'Fuera', content: 'Fuera' }, async () => {})).rejects.toThrow();
    await expect(store.create(job, 'coordinador', 'text', { name: 'datos.csv', title: 'Datos', content: '=HYPERLINK("externo")' }, async () => {})).rejects.toThrow();
    service.close();
  });
  it('elimina el archivo aún no confirmado si se revoca después de rename', async () => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    const job = service.state().jobs[0]; const store = new ArtifactStore(repository);
    let calls = 0;
    await expect(store.create(job, 'coordinador', 'text', { name: 'aborto.md', title: 'Cancelado', content: 'No confirmado' }, async () => {
      if (++calls === 3) throw new Error('Revocado');
    })).rejects.toThrow('Revocado');
    const directory = path.join(repository.folder(job.scope, job.id), 'coordinador');
    expect(fs.readdirSync(directory).some(file => file.endsWith('-aborto.md'))).toBe(false); service.close();
  });
  it('no duplica una creación confirmada al repetir el mismo paso', async () => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    const job = service.state().jobs[0]; const store = new ArtifactStore(repository); const guard = async () => {};
    const input = { name: 'estable.md', title: 'Paso', content: 'Contenido confirmado' };
    const first = await store.create(job, 'coordinador', 'text', input, guard); job.artifacts.push(first);
    const next = await store.create(job, 'coordinador', 'text', input, guard);
    expect(next.id).toBe(first.id);
    expect(fs.readdirSync(path.join(repository.folder(job.scope, job.id), 'coordinador')).filter(name => name.endsWith('-estable.md'))).toHaveLength(1);
    service.close();
  });
  it.each(['-HYPERLINK("externo")', '"-cmd|comando"', 'Dato,\t@FORMULA()', 'Dato,"+SUM(1)"'])('rechaza prefijos CSV peligrosos: %s', async content => {
    const { service, repository } = fixture(); await service.context(null); await service.start(request()); await service.idle();
    await expect(new ArtifactStore(repository).create(service.state().jobs[0], 'coordinador', 'text', { name: 'datos.csv', title: 'Datos', content }, async () => {})).rejects.toThrow();
    service.close();
  });
});
describe('Selección del equipo ejecutor', () => {
  it.each(['usa multiagentes para proponer ideas', 'Investiga referencias en segundo plano', 'Crea un documento Word sobre el proyecto'])('activa con el encargo humano: %s', task => { expect(wantsBackgroundTeam(task)).toBe(true); });
  it.each(['No uses multiagentes para crear un documento', 'modo directo: crea un documento', 'Qué significa "usa multiagentes"', '> usa multiagentes\nExplícame esta frase', 'Hola', 'No trabajes en segundo plano, crea un informe', 'Crea un documento sin segundo plano', 'Crea un PDF', 'Crea un documento y envíalo por correo'])('no activa desde negaciones, citas ni tareas supervisadas: %s', task => { expect(wantsBackgroundTeam(task)).toBe(false); });
});

