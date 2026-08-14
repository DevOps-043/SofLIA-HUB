import type { PassiveSkillRule } from './types';

/**
 * Detecciones automaticas del producto.
 *
 * No son programables y no salen del `TaskScheduler`: corren en su propio
 * servicio. Se listan igualmente porque, si no aparecieran, el usuario las
 * buscaria para crearlas y acabaria con una rutina que duplica el trabajo de un
 * servicio que ya la hace.
 */

const MARCA_DE_TIEMPO_SISTEMA = new Date(0).toISOString();

export function systemPassiveRules(meetingDetectionAvailable: boolean): PassiveSkillRule[] {
  return [{
    id: 'system:reuniones-auto',
    skillId: null,
    skillName: 'Reuniones',
    name: 'Deteccion automatica de reuniones',
    description:
      'Escanea Calendar, Gmail y Drive para detectar material de reunion, y admite disparos externos para iniciar la trazabilidad. Las minutas resultantes se revisan en el panel de Reuniones.',
    prompt: 'Deteccion automatica del sistema',
    scheduleLabel: 'Cada 20 minutos y por eventos de Google',
    cronExpression: null,
    runOnce: false,
    scheduledFor: null,
    channels: ['escritorio'],
    source: 'system',
    status: meetingDetectionAvailable ? 'system' : 'blocked',
    createdAt: MARCA_DE_TIEMPO_SISTEMA,
    updatedAt: MARCA_DE_TIEMPO_SISTEMA,
    lastRunAt: null,
    requestedBy: null,
    phoneNumber: null,
    reason: meetingDetectionAvailable
      ? 'Activa en segundo plano. No necesita programacion.'
      : 'Bloqueada: conecta Google Calendar y resuelve la correspondencia de usuarios para activarla.',
  }];
}
