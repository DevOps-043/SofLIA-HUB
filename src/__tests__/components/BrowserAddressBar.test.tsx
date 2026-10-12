import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserAddressBar } from '../../components/browser/BrowserAddressBar';
import { BROWSER_HOME_URL } from '../../shared/browser-home';
import { integratedBrowserService } from '../../services/integrated-browser-service';

vi.mock('../../components/browser/BrowserSitePermissionsPanel', () => ({ BrowserSitePermissionsPanel: () => null }));
vi.mock('../../components/browser/BrowserPermissionPrompt', () => ({ BrowserPermissionPrompt: () => null }));
vi.mock('../../components/browser/BrowserAgentPolicyPrompt', () => ({ BrowserAgentPolicyPrompt: () => null }));

const navigate = vi.fn();
function Bar({ url = BROWSER_HOME_URL }: { url?: string }) {
  const [address, setAddress] = useState('');
  return <BrowserAddressBar address={address} currentUrl={url} onAddressChange={setAddress} onEditingChange={() => {}} onNavigate={navigate} />;
}
async function suggest(value: string) {
  const field = screen.getByRole('combobox');
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value } });
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  return field;
}
function submit(field: HTMLElement) { fireEvent.submit(field.closest('form')!); }

describe('destino explícito en la barra', () => {
  beforeEach(() => {
    vi.useFakeTimers(); navigate.mockClear();
    vi.spyOn(integratedBrowserService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(integratedBrowserService, 'listHistory').mockResolvedValue({ success: true, history: [
      { id: 'google', title: 'Google', url: 'https://www.google.com/', visitedAt: '2026-10-10T00:00:00Z' },
      { id: 'soflia', title: 'SofLIA', url: 'https://soflia.ai/', visitedAt: '2026-10-10T00:00:00Z' },
    ] });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('no consulta ni navega al enfocar o enviar el inicio vacío', async () => {
    render(<Bar />);
    const field = screen.getByRole('combobox');
    fireEvent.focus(field);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    submit(field);
    expect(integratedBrowserService.listHistory).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('el cursor sobre Google no sustituye la búsqueda escrita', async () => {
    render(<Bar />);
    const field = await suggest('diseño profesional');
    fireEvent.mouseEnter(screen.getByRole('option', { name: /Google/ }));
    submit(field);
    expect(navigate).toHaveBeenCalledWith('diseño profesional');
  });

  it.each([['ArrowDown', 'https://www.google.com/'], ['ArrowUp', 'https://soflia.ai/']])('elige el extremo correcto con %s', async (key, url) => {
    render(<Bar />);
    const field = await suggest('consulta');
    fireEvent.keyDown(field, { key });
    submit(field);
    expect(navigate).toHaveBeenCalledWith(url);
  });

  it('Escape retira la selección para que Enter use el texto', async () => {
    render(<Bar />);
    const field = await suggest('consulta');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'Escape' });
    submit(field);
    expect(navigate).toHaveBeenCalledWith('consulta');
  });

  it('un clic sí abre el destino elegido', async () => {
    render(<Bar />);
    await suggest('consulta');
    fireEvent.click(screen.getByRole('option', { name: /SofLIA/ }));
    expect(navigate).toHaveBeenCalledWith('https://soflia.ai/');
  });
});
