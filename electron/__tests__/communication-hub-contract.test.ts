import { describe, expect, it, vi } from 'vitest';
import { communicationActor, communicationConnection, communicationMessage, communicationPolicy, communicationPreferences } from '../communication-hub/ipc-contract';
const actor = { userId: 'usuario', organizationId: 'org' };
const message = { provider: 'telegram', scope: 'personal', recipient: '-12345', text: 'prueba' };
describe('Schemas de Communication Hub', () => {
  it.each([
    { ...message, provider: 'otro' }, { ...message, scope: 'otro' }, { ...message, recipient: {} }, { ...message, recipient: 'https://ajeno.invalid' },
    { ...message, text: '' }, { ...message, text: 'a'.repeat(16385) }, { ...message, metadata: { secreto: 'no' } }, { ...message, metadata: { segment: {} } },
    { ...message, actor: { ...actor, role: 'owner' } }, { ...message, actor: { userId: 'ajeno' } }, { ...message, path: '/tmp/no' },
    { ...message, provider: ['whatsapp'] }, { ...message, scope: ['organization'] },
  ])('rechaza mensaje no válido %#', input => expect(() => communicationMessage(input, actor, false)).toThrow());
  it.each(['pasado', 'ayer', '2020-01-01T00:00:00Z'])('rechaza horario %s', scheduledAt => expect(() => communicationMessage({ ...message, scheduledAt }, actor, true)).toThrow());
  it('copia el snapshot sin conservar identidad del input', () => { const input = { ...message, metadata: { segment: 'prueba' } }; const result = communicationMessage(input, actor, false); input.metadata.segment = 'otro'; expect(result.metadata).toEqual({ segment: 'prueba' }); expect(result.actor).toEqual(actor); });
  it('no evalúa getters, prototipos ni ciclos', () => { const getter = vi.fn(); expect(() => communicationMessage(Object.defineProperty({ ...message }, 'text', { get: getter }), actor, false)).toThrow(); expect(getter).not.toHaveBeenCalled(); expect(() => communicationPreferences(new Date())).toThrow(); const cycle: { a?: unknown } = {}; cycle.a = cycle; expect(() => communicationPreferences(cycle)).toThrow(); });
  it.each([{ unknown: true }, { notificationsEnabled: 'sí' }, { telegramChatId: 'a'.repeat(257) }])('rechaza preferencias no válidas %#', input => expect(() => communicationPreferences(input)).toThrow());
  it.each([{ updatedBy: 'ajeno' }, { organizationId: 'otra' }, { campaigns: { dailyLimit: 0 } }, { campaigns: { requirePreview: 'no' } }, { whatsapp: { groupPolicy: 'superadmin' } }, { telegram: { allowedChatIds: Array(101).fill('1') } }, { whatsapp: { groupPolicy: ['open'] } }, { whatsapp: { groupActivation: ['mention'] } }])('rechaza política no válida %#', input => expect(() => communicationPolicy(input)).toThrow());
  it.each([{ provider: 'otro' }, { provider: 'whatsapp', action: 'connect', apiKey: 'no' }, { provider: 'telegram', updates: { hidden: true } }, { provider: 'telegram', updates: { poll_interval_ms: 0 } }, { provider: 'whatsapp', action: ['connect'] }])('rechaza conexión no válida %#', input => expect(() => communicationConnection(input)).toThrow());
  it('actor implícito se deriva y un hint no nulo no suplanta', () => { expect(communicationActor(undefined, actor)).toEqual(actor); expect(() => communicationActor({ userId: 4 }, actor)).toThrow(); });
});
