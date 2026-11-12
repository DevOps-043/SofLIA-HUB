import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAvatarPresence } from '../../components/avatar/avatar-presence';
import { draftExpression, responseExpression, toolOutcome } from '../../components/avatar/avatar-reactions';
import { avatarPermission, withAvatarPermission } from '../../services/avatar-permission';

afterEach(() => { vi.useRealTimers(); });
function presence() {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  const actor = createAvatarPresence(); const stop = actor.subscribe(() => {});
  return { actor, stop };
}
describe('presencia vinculada a tareas reales', () => {
  it('saluda, espera, duerme tras 20 segundos y despierta al interactuar', () => {
    const { actor, stop } = presence(); actor.update({ mode: 'listening', activation: 1 });
    expect(actor.getSnapshot()).toBe('happy');
    vi.advanceTimersByTime(900); expect(actor.getSnapshot()).toBe('idle');
    vi.advanceTimersByTime(300); expect(actor.getSnapshot()).toBe('listening');
    vi.advanceTimersByTime(18_799); expect(actor.getSnapshot()).toBe('listening');
    vi.advanceTimersByTime(1); expect(actor.getSnapshot()).toBe('sleeping');
    actor.touch(); expect(actor.getSnapshot()).toBe('listening'); stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('no retrasa el reposo cuando el dictado termina por ocho segundos de silencio', () => {
    const { actor, stop } = presence(); actor.update({ mode: 'listening' });
    vi.advanceTimersByTime(8000); actor.update({ mode: 'idle' });
    vi.advanceTimersByTime(11_999); expect(actor.getSnapshot()).toBe('idle');
    vi.advanceTimersByTime(1); expect(actor.getSnapshot()).toBe('sleeping'); stop();
  });
  it('prioriza permisos, errores y ejecución; el trabajo prolongado se concentra', () => {
    const { actor, stop } = presence();
    actor.update({ mode: 'thinking', draft: 'wow!!', busy: true });
    expect(actor.getSnapshot()).toBe('thinking');
    vi.advanceTimersByTime(6000); expect(actor.getSnapshot()).toBe('focused');
    actor.update({ mode: 'focused', permission: true, error: true }); expect(actor.getSnapshot()).toBe('warning');
    actor.update({ mode: 'focused', error: true }); expect(actor.getSnapshot()).toBe('concerned');
    vi.advanceTimersByTime(30_000); expect(actor.getSnapshot()).toBe('concerned'); stop();
  });
  it('no arrastra el resultado ni los temporizadores entre conversaciones', () => {
    const { actor, stop } = presence();
    actor.update({ scope: 'a', outcome: { key: '1', expression: 'success' } }); expect(actor.getSnapshot()).toBe('success');
    actor.update({ scope: 'b' }); expect(actor.getSnapshot()).toBe('happy');
    vi.advanceTimersByTime(1200); expect(actor.getSnapshot()).toBe('idle'); stop();
  });
  it('libera un gesto transitorio antes de reposar y no celebra un trabajo pendiente', () => {
    const { actor, stop } = presence();
    actor.update({ outcome: { key: '1', expression: 'acknowledging' } });
    expect(actor.getSnapshot()).toBe('acknowledging'); vi.advanceTimersByTime(2400); expect(actor.getSnapshot()).toBe('idle'); stop();
    expect(responseExpression('Listo', [{ result: '{"success":true,"status":"running"}' }])).toBe('focused');
    expect(responseExpression('Listo', [{ result: '{"success":false,"error":"Falló"}' }])).toBe('concerned');
    expect(responseExpression('Listo', [{ result: '{"success":true}' }])).toBe('success');
    expect(responseExpression('Listo', [{ result: 'Respuesta sin contrato' }])).toBe('acknowledging');
    expect(responseExpression('Confirmado.')).toBe('acknowledging');
    expect(toolOutcome('{"cancelled":true}')).toBe('cancelled');
  });
  it.each([['¿Cómo funciona?', 'curious'], ['wow!!', 'surprised'], ['no entiendo??', 'confused'], ['Eliminar contraseña', 'warning'], ['', 'idle']])('reacciona al borrador %s de forma local', (draft, expression) => {
    expect(draftExpression(draft)).toBe(expression);
  });
  it('observa permisos concurrentes y limpia al cancelar sin aprobar acciones', async () => {
    const controller = new AbortController(); let finish!: (value: boolean) => void;
    const operation = withAvatarPermission(() => new Promise<boolean>(resolve => { finish = resolve; }), controller.signal);
    expect(avatarPermission.getSnapshot()).toBe(true);
    controller.abort(); expect(avatarPermission.getSnapshot()).toBe(false);
    finish(false); expect(await operation).toBe(false); expect(avatarPermission.getSnapshot()).toBe(false);
    await expect(withAvatarPermission(async () => { throw new Error('Sin autorización'); })).rejects.toThrow('Sin autorización');
    expect(avatarPermission.getSnapshot()).toBe(false);
  });
});
