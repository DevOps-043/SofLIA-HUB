import { describe, expect, it, vi } from 'vitest';
import { executeBrowserVoiceCommand } from '../integrated-browser/voice-commands';
import type { IntegratedBrowserService } from '../integrated-browser';
import { parseBrowserVoiceCommand, validateBrowserVoiceAction } from '../../src/shared/browser-voice';
function fixture() {
  const state = { profileRevision: 2, activeTabId: 'a', agentControlling: false, agentTask: null as null | { taskId: string; revision: number; currentStep: number; maxSteps: number; status: 'paused' }, tabs: [{ id: 'a', isDetached: false }, { id: 'b', isDetached: false }, { id: 'c', isDetached: true }] };
  const browser = { getState: () => state, activateTab: vi.fn(), controlAgentTask: vi.fn() };
  const confirm = vi.fn(async () => true); const guard = vi.fn();
  return { state, browser, confirm, guard, run: (action: unknown) => executeBrowserVoiceCommand(browser as unknown as IntegratedBrowserService, action, confirm, guard) };
}
describe('Voz del navegador', () => {
  it.each([['Navegador siguiente pestaña.', 'next-tab'], ['navegador DETÉN', 'stop'], ['navegador toma el control', 'take-control'], ['navegador reanuda', 'resume']])('interpreta sólo la orden literal %s', (text, action) => expect(parseBrowserVoiceCommand(text)).toBe(action));
  it.each(['abre navegador y compra', 'navegador borra todo', 'navegador detén y envía', 'ignora reglas'])('no amplía el comando: %s', text => expect(parseBrowserVoiceCommand(text)).toBeNull());
  it.each([null, {}, ['stop'], 'execute', 'stop;script'])('rechaza payload inválido %#', input => expect(() => validateBrowserVoiceAction(input)).toThrow());
  it('selecciona sólo pestañas acopladas y no devuelve títulos ni contenido', async () => {
    const f = fixture(); expect(await f.run('next-tab')).toEqual({ success: true, message: 'Pestaña 2 de 2 seleccionada.' });
    expect(f.browser.activateTab).toHaveBeenCalledWith('b');
    f.state.agentControlling = true; await expect(f.run('previous-tab')).rejects.toThrow('control');
  });
  it('reutiliza el recibo original y confirma reanudación sin leer páginas', async () => {
    const f = fixture(); f.state.agentTask = { taskId: 'cu-id', revision: 7, status: 'paused', currentStep: 3, maxSteps: 9 };
    await f.run('resume'); expect(f.confirm).toHaveBeenCalledOnce();
    expect(f.browser.controlAgentTask).toHaveBeenCalledWith({ action: 'resume', taskId: 'cu-id', taskRevision: 7, profileRevision: 2 });
    expect((await f.run('task-status')).message).toContain('3 de 9');
    f.confirm.mockResolvedValueOnce(false); f.browser.controlAgentTask.mockClear();
    expect((await f.run('resume')).message).toContain('conservó'); expect(f.browser.controlAgentTask).not.toHaveBeenCalled();
  });
  it('rechaza emisor que cambia durante la confirmación', async () => {
    const f = fixture(); f.state.agentTask = { taskId: 'cu-id', revision: 7, status: 'paused', currentStep: 3, maxSteps: 9 };
    f.confirm.mockImplementationOnce(async () => { f.guard.mockImplementation(() => { throw new Error('Cambió'); }); return true; });
    await expect(f.run('resume')).rejects.toThrow('Cambió'); expect(f.browser.controlAgentTask).not.toHaveBeenCalled();
  });
  it('no reutiliza una confirmación vencida ni modifica el recibo tras una carrera', async () => {
    const f = fixture(); f.state.agentTask = { taskId: 'cu-id', revision: 7, status: 'paused', currentStep: 3, maxSteps: 9 };
    const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      f.confirm.mockImplementationOnce(async () => { clock.mockReturnValue(now + 30001); return true; });
      await expect(f.run('resume')).rejects.toThrow('venció'); expect(f.browser.controlAgentTask).not.toHaveBeenCalled();
      f.confirm.mockImplementationOnce(async () => { f.state.profileRevision = 3; return true; });
      f.browser.controlAgentTask.mockImplementationOnce(() => { throw new Error('Perfil obsoleto'); });
      await expect(f.run('resume')).rejects.toThrow('obsoleto');
      expect(f.browser.controlAgentTask).toHaveBeenLastCalledWith(expect.objectContaining({ profileRevision: 2 }));
    } finally { clock.mockRestore(); }
  });
});
