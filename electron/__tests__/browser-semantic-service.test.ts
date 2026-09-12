import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import { IntegratedBrowserService } from '../integrated-browser/service';
import { BrowserSemanticMemory } from '../integrated-browser/semantic-memory';
import { browserScopeIdFor, resetBrowserScopeForTests, setBrowserScopeId } from '../integrated-browser/profile-scope';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); resetBrowserScopeForTests(); });
describe('frontera humana de memoria', () => {
  it('deniega capacidad apagada, invitado y recibo de otro perfil antes de E/S', async () => {
    const run = vi.spyOn(BrowserSemanticMemory.prototype, 'run');
    const disabled = new IntegratedBrowserService(); disabled.attachWindow(new BrowserWindow());
    await expect(disabled.semanticMemoryCommand({ action: 'status', profileRevision: 0 })).rejects.toThrow();
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    await expect(browser.semanticMemoryCommand({ action: 'status', profileRevision: 0 })).rejects.toThrow();
    setBrowserScopeId(browserScopeIdFor('ficticio'));
    await expect(browser.semanticMemoryCommand({ action: 'enable', profileRevision: 999 })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
  it.each(['aceptar', 'cancelar', 'perfil', 'ventana'] as const)('consentimiento nativo vigente y sin aprobación renderer: %s', async mode => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true'); setBrowserScopeId(browserScopeIdFor('ficticio'));
    const window = new BrowserWindow(); const browser = new IntegratedBrowserService(); browser.attachWindow(window);
    const approved = vi.fn();
    vi.spyOn(BrowserSemanticMemory.prototype, 'run').mockImplementation(async (_request, context) => {
      const accepted = await context.confirm('enable'); context.guard(); if (accepted) approved(); return { success: true, canceled: !accepted };
    });
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async (...args) => {
      const options = args[args.length - 1] as MessageBoxOptions;
      expect(options).toMatchObject({ defaultId: 0, cancelId: 0 }); expect(options.detail).toContain('Google'); expect(options.detail).toContain('costes');
      if (mode === 'perfil') setBrowserScopeId(browserScopeIdFor('otra-cuenta'));
      if (mode === 'ventana') vi.mocked(window.isDestroyed).mockReturnValue(true);
      return { response: mode === 'cancelar' ? 0 : 1, checkboxChecked: false };
    });
    const result = browser.semanticMemoryCommand({ action: 'enable', profileRevision: browser.getState().profileRevision! });
    if (mode === 'perfil' || mode === 'ventana') await expect(result).rejects.toThrow();
    else expect(await result).toMatchObject({ success: true, canceled: mode === 'cancelar' });
    expect(approved).toHaveBeenCalledTimes(mode === 'aceptar' ? 1 : 0);
  });
});
