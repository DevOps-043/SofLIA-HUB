import { describe, expect, it, vi } from 'vitest';
import { normalizeScheduledTask } from '../task-scheduler/normalizer';
import { deliverToChannels } from '../passive-skills/delivery';
import { systemPassiveRules } from '../passive-skills/system-rules';

describe('normalizacion de tareas programadas', () => {
  it('traduce un workflow antiguo a la Skill que lo sustituye', () => {
    const task = normalizeScheduledTask({
      id: 'task_1',
      cronExpression: '0 8 * * *',
      prompt: 'Resumen de correos',
      phoneNumber: '5215500000000',
      workflowId: 'correo',
      kind: 'passive_workflow' as any,
    });

    expect(task.skillId).toBe('sistema:correo');
    expect(task.kind).toBe('passive_skill');
    // Se conserva para que revertir la version no pierda la programacion.
    expect(task.workflowId).toBe('correo');
  });

  it('una tarea antigua con telefono se entrega por WhatsApp', () => {
    const task = normalizeScheduledTask({
      id: 'task_2',
      cronExpression: '0 8 * * *',
      prompt: 'x',
      phoneNumber: '5215500000000',
    });
    expect(task.channels).toEqual(['whatsapp']);
  });

  it('una tarea antigua sin telefono se entrega en la computadora', () => {
    const task = normalizeScheduledTask({ id: 'task_3', cronExpression: '0 8 * * *', prompt: 'x' });
    expect(task.channels).toEqual(['escritorio']);
  });

  it('respeta los canales ya declarados', () => {
    const task = normalizeScheduledTask({
      id: 'task_4',
      cronExpression: '0 8 * * *',
      prompt: 'x',
      phoneNumber: '5215500000000',
      channels: ['escritorio', 'telegram'],
    });
    expect(task.channels).toEqual(['escritorio', 'telegram']);
  });

  it('un workflow sin Skill equivalente queda como rutina libre', () => {
    const task = normalizeScheduledTask({
      id: 'task_5',
      cronExpression: '0 8 * * *',
      prompt: 'x',
      workflowId: 'reuniones',
    });
    expect(task.skillId).toBeNull();
  });
});

describe('entrega por canal', () => {
  const target = { channels: ['whatsapp', 'telegram', 'escritorio'] as const, phoneNumber: '5215500000000', title: 'Noticias' };

  it('entrega en todos los canales declarados', async () => {
    const sendWhatsApp = vi.fn(async () => undefined);
    const sendTelegram = vi.fn(async () => undefined);
    const announceOnOrb = vi.fn(async () => undefined);

    const resultados = await deliverToChannels('Hola', target, { sendWhatsApp, sendTelegram, announceOnOrb });

    expect(sendWhatsApp).toHaveBeenCalledWith('5215500000000', 'Hola');
    expect(sendTelegram).toHaveBeenCalledWith('Hola');
    expect(announceOnOrb).toHaveBeenCalledWith('Hola', { title: 'Noticias' });
    expect(resultados.every((resultado) => resultado.ok)).toBe(true);
  });

  it('el fallo de un canal no impide la entrega en los demas', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sendTelegram = vi.fn(async () => undefined);
    const announceOnOrb = vi.fn(async () => undefined);

    const resultados = await deliverToChannels('Hola', target, {
      // WhatsApp desconectado: el canal no esta disponible en este arranque.
      sendWhatsApp: undefined,
      sendTelegram,
      announceOnOrb,
    });

    expect(sendTelegram).toHaveBeenCalled();
    expect(announceOnOrb).toHaveBeenCalled();
    expect(resultados.find((resultado) => resultado.channel === 'whatsapp')?.ok).toBe(false);
    aviso.mockRestore();
  });

  it('un canal que lanza no arrastra a los demas', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sendTelegram = vi.fn(async () => undefined);

    const resultados = await deliverToChannels('Hola', { ...target, channels: ['whatsapp', 'telegram'] }, {
      sendWhatsApp: vi.fn(async () => { throw new Error('sesion caida'); }),
      sendTelegram,
    });

    expect(sendTelegram).toHaveBeenCalled();
    const whatsapp = resultados.find((resultado) => resultado.channel === 'whatsapp');
    expect(whatsapp?.ok).toBe(false);
    expect(whatsapp && !whatsapp.ok ? whatsapp.reason : '').toContain('sesion caida');
    aviso.mockRestore();
  });

  it('sin numero no intenta enviar por WhatsApp', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sendWhatsApp = vi.fn(async () => undefined);

    const resultados = await deliverToChannels('Hola', { channels: ['whatsapp'], phoneNumber: null, title: 'x' }, { sendWhatsApp });

    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(resultados[0].ok).toBe(false);
    aviso.mockRestore();
  });

  it('un resultado vacio no se entrega a ningun canal', async () => {
    const sendWhatsApp = vi.fn(async () => undefined);
    const resultados = await deliverToChannels('   ', target, { sendWhatsApp });
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(resultados.every((resultado) => !resultado.ok)).toBe(true);
  });
});

describe('capacidades automaticas del sistema', () => {
  it('se listan activas cuando la deteccion corre', () => {
    const [regla] = systemPassiveRules(true);
    expect(regla.status).toBe('system');
    expect(regla.cronExpression).toBeNull();
  });

  it('se listan bloqueadas, con motivo, cuando no corre', () => {
    const [regla] = systemPassiveRules(false);
    expect(regla.status).toBe('blocked');
    expect(regla.reason).toContain('Google Calendar');
  });
});
