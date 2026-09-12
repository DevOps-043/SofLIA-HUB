import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserGroupEditor, BrowserVerticalTabs } from '../../components/browser/BrowserTabWorkspace';
import { integratedBrowserService, type IntegratedBrowserTabState } from '../../services/integrated-browser-service';

const tabs: IntegratedBrowserTabState[] = ['Primera', 'Segunda'].map((title, index) => ({
  id: String(index), title, url: 'https://example.com', isLoading: false, error: null, isSuspended: false, isDetached: false,
}));
afterEach(() => vi.restoreAllMocks());

describe('organización de pestañas', () => {
  it('muestra una tira vertical y permite navegar, reordenar y cerrar por teclado', () => {
    const activate = vi.fn(); const close = vi.fn(); const reorder = vi.fn();
    render(<BrowserVerticalTabs tabs={tabs} groups={[]} activeTabId="0" onActivate={activate} onClose={close} onReorder={reorder} />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Primera' }), { key: 'ArrowDown' });
    expect(activate).toHaveBeenCalledWith('1');
    expect(screen.getByRole('tab', { name: 'Segunda' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Segunda' }), { key: 'ArrowUp', ctrlKey: true, shiftKey: true });
    expect(reorder).toHaveBeenCalledWith('1', '0');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Segunda' }), { key: 'Delete' });
    expect(close).toHaveBeenCalledWith('1');
  });

  it('crea y asigna el nombre y color elegidos por la persona', async () => {
    const create = vi.spyOn(integratedBrowserService, 'createTabGroup').mockResolvedValue({ success: true, group: { id: 'grupo', name: 'Proyecto', color: 'green', collapsed: false } });
    const assign = vi.spyOn(integratedBrowserService, 'assignTabGroup').mockResolvedValue({ success: true });
    const close = vi.fn();
    render(<BrowserGroupEditor tabId="1" groups={[]} onClose={close} onChanged={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Proyecto' } });
    fireEvent.change(screen.getByLabelText('Color del grupo'), { target: { value: 'green' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear y asignar' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith('Proyecto', 'green');
    expect(assign).toHaveBeenCalledWith('1', 'grupo');
  });

  it('conserva el editor y muestra el error si falla la asignación', async () => {
    vi.spyOn(integratedBrowserService, 'assignTabGroup').mockResolvedValue({ success: false, error: 'Pestaña cerrada' });
    const close = vi.fn();
    render(<BrowserGroupEditor tabId="1" groups={[]} onClose={close} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar del grupo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pestaña cerrada');
    expect(close).not.toHaveBeenCalled();
  });
});
