import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositorio = vi.hoisted(() => ({
  listForUser: vi.fn(),
  upsertRule: vi.fn(),
  removeRule: vi.fn(),
  insertMigrated: vi.fn(),
}));

vi.mock('../passive-skills/repository', () => repositorio);
vi.mock('../skill-catalog/system-skills-store', () => ({
  systemSkillsFor: vi.fn(async () => [{ id: 'sistema:correo', name: 'Correo' }]),
}));
vi.mock('../main/hub-session', () => ({ getHubSessionUserId: () => null }));

import { PassiveSkillsService } from '../passive-skills/service';

/** Planificador falso: guarda tareas en memoria y expone lo mismo que el real. */
function crearPlanificador(tareasIniciales: any[] = []) {
  const tareas = new Map<string, any>(tareasIniciales.map((t) => [t.id, t]));
  return {
    getTasks: () => Array.from(tareas.values()),
    upsertTask: vi.fn((input: any) => {
      const task = {
        ...input,
        id: input.id || `task-${tareas.size + 1}`,
        createdAt: input.createdAt || '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
      };
      tareas.set(task.id, task);
      return task;
    }),
    deleteTask: vi.fn((id: string) => tareas.delete(id)),
  };
}

function tareaPasiva(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'passive_skill',
    cronExpression: '0 8 * * *',
    prompt: 'Dame las noticias',
    name: `Rutina ${id}`,
    phoneNumber: '5215500000000',
    channels: ['whatsapp'],
    skillId: 'sistema:correo',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...extra,
  };
}

const entrada = {
  name: 'Noticias IA',
  prompt: 'Dame las noticias de IA',
  cronExpression: '0 8 * * *',
  channels: ['whatsapp'] as const,
  phoneNumber: '5215500000000',
};

describe('persistencia de las skills pasivas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin sesion no se pueden guardar: son de un usuario y main no sabe de cual', async () => {
    const scheduler = crearPlanificador();
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => null });

    await expect(service.saveRule({ ...entrada, channels: [...entrada.channels] })).rejects.toThrow(/sesion iniciada/i);
    // No debe quedar un cron levantado de algo que no se pudo guardar.
    expect(scheduler.upsertTask).not.toHaveBeenCalled();
  });

  it('sin sesion no lista reglas, pero sigue mostrando las automaticas del sistema', async () => {
    const service = new PassiveSkillsService({
      taskScheduler: crearPlanificador([tareaPasiva('t1')]) as any,
      getUserId: () => null,
    });

    const overview = await service.getOverview();
    expect(overview.rules).toEqual([]);
    expect(overview.systemRules).toHaveLength(1);
  });

  it('guarda en la base y deja el cron levantado', async () => {
    repositorio.upsertRule.mockResolvedValue(true);
    const scheduler = crearPlanificador();
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    const rule = await service.saveRule({ ...entrada, channels: [...entrada.channels] });

    expect(repositorio.upsertRule).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'Noticias IA' }));
    expect(scheduler.getTasks()).toHaveLength(1);
    expect(rule.channels).toEqual(['whatsapp']);
  });

  it('si la base falla, deshace el alta local en vez de dejarla huerfana', async () => {
    repositorio.upsertRule.mockResolvedValue(false);
    const scheduler = crearPlanificador();
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    await expect(service.saveRule({ ...entrada, channels: [...entrada.channels] })).rejects.toThrow(/No pude guardar/i);
    // Sobreviviria al reinicio y la borraria la primera lectura correcta: el
    // usuario se habria quedado creyendo que estaba programada.
    expect(scheduler.getTasks()).toHaveLength(0);
  });

  it('la base manda sobre la cache: reconcilia lo que ya no existe', async () => {
    repositorio.listForUser.mockResolvedValue([]);
    const scheduler = crearPlanificador([tareaPasiva('borrada-en-otro-equipo')]);
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    const overview = await service.getOverview();

    expect(overview.rules).toEqual([]);
    expect(scheduler.deleteTask).toHaveBeenCalledWith('borrada-en-otro-equipo');
  });

  it('la base manda sobre la cache: levanta lo que falta localmente', async () => {
    repositorio.listForUser.mockResolvedValue([{
      id: 'creada-en-otro-equipo',
      skillId: 'sistema:correo',
      skillName: 'Correo',
      name: 'Desde el movil',
      description: '',
      prompt: 'Revisa el correo',
      scheduleLabel: 'Todos los dias a las 08:00',
      cronExpression: '0 8 * * *',
      runOnce: false,
      scheduledFor: null,
      channels: ['whatsapp'],
      source: 'app',
      status: 'active',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      lastRunAt: null,
      requestedBy: null,
      phoneNumber: '5215500000000',
      reason: null,
    }]);
    const scheduler = crearPlanificador();
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    const overview = await service.getOverview();

    expect(overview.rules).toHaveLength(1);
    expect(scheduler.upsertTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'creada-en-otro-equipo' }));
    // El nombre se resuelve del catalogo, no se muestra el identificador.
    expect(overview.rules[0].skillName).toBe('Correo');
  });

  it('sin red se listan las reglas levantadas localmente', async () => {
    repositorio.listForUser.mockResolvedValue(null);
    const scheduler = crearPlanificador([tareaPasiva('t1')]);
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    const overview = await service.getOverview();

    expect(overview.rules).toHaveLength(1);
    // No se reconcilia a ciegas: borrar aqui apagaria rutinas por una caida.
    expect(scheduler.deleteTask).not.toHaveBeenCalled();
  });

  it('si la base no pudo borrar, no se apaga el cron', async () => {
    repositorio.removeRule.mockResolvedValue(false);
    const scheduler = crearPlanificador([tareaPasiva('t1')]);
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    await expect(service.deleteRule('t1')).rejects.toThrow(/No pude eliminar/i);
    // Reaparecería en la siguiente lectura; apagarla aqui seria mentir.
    expect(scheduler.deleteTask).not.toHaveBeenCalled();
  });

  it('cerrar sesion vacia la cache local', async () => {
    const scheduler = crearPlanificador([tareaPasiva('t1'), tareaPasiva('t2')]);
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    service.clearLocalRules();

    expect(scheduler.deleteTask).toHaveBeenCalledTimes(2);
  });

  it('la migracion atribuye las reglas locales al usuario en sesion', async () => {
    repositorio.insertMigrated.mockResolvedValue(2);
    const scheduler = crearPlanificador([tareaPasiva('t1'), tareaPasiva('t2')]);
    const service = new PassiveSkillsService({ taskScheduler: scheduler as any, getUserId: () => 'user-1' });

    expect(await service.migrateLocalRules()).toBe(2);
    expect(repositorio.insertMigrated).toHaveBeenCalledWith('user-1', expect.arrayContaining([
      expect.objectContaining({ id: 't1' }),
    ]));
  });

  it('sin sesion no se migra nada: no se atribuyen reglas a quien mire', async () => {
    const service = new PassiveSkillsService({
      taskScheduler: crearPlanificador([tareaPasiva('t1')]) as any,
      getUserId: () => null,
    });

    expect(await service.migrateLocalRules()).toBe(0);
    expect(repositorio.insertMigrated).not.toHaveBeenCalled();
  });
});
