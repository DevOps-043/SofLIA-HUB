import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), launch: vi.fn(), focus: vi.fn() }));
vi.mock('../computer-use/app-resolver', () => ({
  looksLikeConcreteApplicationPath: () => false,
  resolveApplicationTarget: mocks.resolve,
  launchPathNonBlocking: mocks.launch,
  focusExistingApplicationWindow: mocks.focus,
}));
vi.mock('../desktop-agent/installed-apps-index', () => ({ findInstalledApp: async () => null }));
import { handleOpenPath } from '../computer-use/app-open-tool';

describe('cancelación durante resolución de aplicaciones', () => {
  it('no lanza ni enfoca si se cancela mientras se busca la aplicación', async () => {
    const abort = new AbortController();
    mocks.resolve.mockImplementationOnce(async () => { abort.abort(); return { path: 'notepad.exe', source: 'path', searchedQuery: 'notepad', alternatives: [] }; });
    const result = await handleOpenPath('open_application', { path: 'notepad' }, undefined, { signal: abort.signal });
    expect(result.success).toBe(false); expect(mocks.focus).not.toHaveBeenCalled(); expect(mocks.launch).not.toHaveBeenCalled();
  });
});
