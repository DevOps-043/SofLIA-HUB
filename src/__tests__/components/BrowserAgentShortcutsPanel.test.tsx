import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserAgentShortcutsPanel } from '../../components/browser/BrowserAgentShortcutsPanel';
import { integratedBrowserService, type IntegratedBrowserState } from '../../services/integrated-browser-service';
import type { BrowserShortcutResponse } from '../../shared/browser-agent-shortcuts';

const entry = { id: '00000000-0000-0000-0000-000000000000', title: 'Resumen', instruction: 'Resume las pestañas', scope: 'selected-tabs' as const, permission: 'read-fragments' as const };
let changed: ((state: IntegratedBrowserState) => void) | undefined;
const state = (profileRevision: number) => ({ profileRevision } as IntegratedBrowserState);
beforeEach(() => {
  vi.spyOn(integratedBrowserService, 'getState').mockResolvedValue({ success: true, state: state(4) });
  vi.spyOn(integratedBrowserService, 'agentShortcuts').mockResolvedValue({ success: true, library: { revision: 1, entries: [entry] } });
  vi.spyOn(integratedBrowserService, 'subscribe').mockImplementation(handlers => { changed = handlers.onStateChanged; return vi.fn(); });
});
afterEach(() => vi.restoreAllMocks());

describe('Biblioteca de atajos del navegador', () => {
  it('elige sin enviar automáticamente y permite mostrar rechazo de borrador existente', async () => {
    const use = vi.fn(() => { throw new Error('Vacía el borrador antes de usar un atajo.'); });
    render(<BrowserAgentShortcutsPanel onUse={use} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Usar Resumen' }));
    expect(use).toHaveBeenCalledWith(entry, 4);
    expect(screen.getByRole('alert')).toHaveTextContent('Vacía el borrador');
    expect(integratedBrowserService.agentShortcuts).toHaveBeenCalledTimes(1);
  });

  it('edita conservando permisos, ID y revisión sin guardar pestañas', async () => {
    render(<BrowserAgentShortcutsPanel onUse={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Resumen' }));
    fireEvent.change(screen.getByLabelText('Instrucciones'), { target: { value: 'Compara los documentos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(integratedBrowserService.agentShortcuts).toHaveBeenLastCalledWith({ action: 'save', profileRevision: 4, revision: 1, entry: { ...entry, instruction: 'Compara los documentos' } }));
  });

  it('crea con campos cerrados y mantiene el elemento si se cancela eliminar', async () => {
    render(<BrowserAgentShortcutsPanel onUse={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Usar Resumen' });
    fireEvent.change(screen.getByLabelText('Nombre del atajo'), { target: { value: 'Comparación' } });
    fireEvent.change(screen.getByLabelText('Instrucciones'), { target: { value: 'Compara' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear atajo' }));
    await waitFor(() => expect(integratedBrowserService.agentShortcuts).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'save', entry: { id: '', title: 'Comparación', instruction: 'Compara', scope: 'selected-tabs', permission: 'read-fragments' } })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Eliminar Resumen' })).toBeEnabled());
    vi.mocked(integratedBrowserService.agentShortcuts).mockResolvedValueOnce({ success: true, canceled: true });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Resumen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Usar Resumen' })).toBeEnabled());
  });

  it('descarta una biblioteca tardía tras cambio de perfil', async () => {
    let finish!: (value: BrowserShortcutResponse) => void;
    vi.mocked(integratedBrowserService.agentShortcuts).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<BrowserAgentShortcutsPanel onUse={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(integratedBrowserService.agentShortcuts).toHaveBeenCalled());
    act(() => changed?.(state(5)));
    await act(async () => finish({ success: true, library: { revision: 1, entries: [entry] } }));
    expect(screen.queryByRole('button', { name: 'Usar Resumen' })).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('perfil cambió');
  });

  it('informa fallo de guardado sin borrar la edición y permite reintentar', async () => {
    render(<BrowserAgentShortcutsPanel onUse={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Resumen' }));
    vi.mocked(integratedBrowserService.agentShortcuts).mockResolvedValueOnce({ success: false, error: 'Los atajos cambiaron.' });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('cambiaron');
    expect(screen.getByLabelText('Instrucciones')).toHaveValue(entry.instruction);
    expect(screen.getByRole('button', { name: 'Actualizar lista' })).toBeEnabled();
  });
});
