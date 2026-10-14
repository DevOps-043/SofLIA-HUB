import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DisplayMediaPicker } from '../../components/display-media/DisplayMediaPicker';
import type { DisplayMediaPickerApi, DisplayMediaPickerSnapshot } from '../../shared/display-media';

const snapshot: DisplayMediaPickerSnapshot = { audioAvailable: true, dark: false, sources: [
  { id: 'screen:1:0', kind: 'screen', name: 'Pantalla 1', thumbnail: 'data:image/png;base64,aA==', appIcon: null },
  { id: 'window:2:0', kind: 'window', name: 'Documento de trabajo', thumbnail: null, appIcon: null },
  { id: 'tab:3', kind: 'tab', name: 'Agenda del taller', thumbnail: 'data:image/png;base64,aA==', appIcon: null },
] };
let api: DisplayMediaPickerApi;
beforeEach(() => {
  api = { list: vi.fn(async () => ({ success: true as const, snapshot })), select: vi.fn(async () => ({ success: true })), cancel: vi.fn(async () => ({ success: true })) };
  window.displayMediaPicker = api;
});
afterEach(() => { delete window.displayMediaPicker; document.documentElement.classList.remove('dark'); });

describe('vista previa de compartir pantalla', () => {
  it('espera una elección explícita, muestra miniatura y confirma sin audio por defecto', async () => {
    render(<DisplayMediaPicker />);
    const share = screen.getByRole('button', { name: 'Compartir' }); expect(share).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Cargando vistas previas' })).toBeInTheDocument();
    const card = await screen.findByRole('button', { name: /Pantalla 1/ });
    expect(screen.getByRole('img', { name: 'Vista previa de Pantalla 1' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(card); expect(card).toHaveAttribute('aria-pressed', 'true'); expect(share).toBeEnabled();
    expect(api.select).not.toHaveBeenCalled();
    fireEvent.click(share); await waitFor(() => expect(api.select).toHaveBeenCalledWith({ sourceId: 'screen:1:0', withSystemAudio: false }));
  });
  it('filtra por categoría y búsqueda y limpia selección al cambiar de categoría', async () => {
    render(<DisplayMediaPicker />); fireEvent.click(await screen.findByRole('button', { name: /Pantalla 1/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Ventanas/ }));
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeDisabled();
    expect(screen.getByText('Vista previa no disponible')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } });
    expect(screen.getByText('No encontramos esa fuente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Pestañas/ }));
    expect(screen.getByText(/Chrome o Edge externos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agenda del taller/ })).toBeInTheDocument();
  });
  it('ofrece audio solo si está disponible y solo lo envía al marcarlo', async () => {
    render(<DisplayMediaPicker />); fireEvent.click(await screen.findByRole('button', { name: /Pantalla 1/ }));
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(api.select).toHaveBeenCalledWith({ sourceId: 'screen:1:0', withSystemAudio: true }));
  });
  it('muestra error recuperable y permite reintentar la enumeración', async () => {
    vi.mocked(api.list).mockResolvedValueOnce({ success: false, error: 'Permiso de captura denegado' });
    render(<DisplayMediaPicker />); expect(await screen.findByRole('alert')).toHaveTextContent('Permiso de captura denegado');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Pantalla 1/ })).toBeInTheDocument();
  });
  it('mantiene el selector abierto con error si la fuente desaparece y elimina selección tras actualizar', async () => {
    vi.mocked(api.select).mockResolvedValueOnce({ success: false, error: 'La ventana se cerró' });
    render(<DisplayMediaPicker />); fireEvent.click(await screen.findByRole('button', { name: /Pantalla 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La ventana se cerró');
    vi.mocked(api.list).mockResolvedValueOnce({ success: true, snapshot: { ...snapshot, sources: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar vistas previas' }));
    await screen.findByText('No hay pantallas disponibles');
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeDisabled();
  });
  it.each(['Cancelar', 'Cerrar selector', 'Escape'])('cancela desde %s sin iniciar captura', async (action) => {
    render(<DisplayMediaPicker />); await screen.findByRole('button', { name: /Pantalla 1/ });
    if (action === 'Escape') fireEvent.keyDown(screen.getByRole('main'), { key: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledOnce()); expect(api.select).not.toHaveBeenCalled();
  });
  it('permite navegar categorías con teclado y adopta tema oscuro', async () => {
    vi.mocked(api.list).mockResolvedValueOnce({ success: true, snapshot: { ...snapshot, dark: true, audioAvailable: false } });
    render(<DisplayMediaPicker />); await screen.findByRole('button', { name: /Pantalla 1/ });
    fireEvent.keyDown(screen.getByRole('tab', { name: /Pantallas/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Ventanas/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /Ventanas/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.documentElement).toHaveClass('dark'); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
