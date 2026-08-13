import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppAttachmentPicker } from '../../adapters/desktop_ui/chat-ui/input/AppAttachmentPicker';
import { AppAttachmentChips } from '../../adapters/desktop_ui/chat-ui/input/AppAttachmentChips';
import type { AppContextAttachmentState } from '../../adapters/desktop_ui/chat-ui/app-attachments';

const inventario = {
  success: true,
  inventory: {
    platform: 'win32',
    availableLevels: ['documento', 'accesibilidad', 'captura'],
    candidates: [
      {
        id: 'app-4321-abc123',
        title: 'Presupuesto 2026 - Excel',
        appName: 'EXCEL',
        pid: 4321,
        thumbnail: 'data:image/png;base64,excel',
        expectedLevel: 'documento' as const,
      },
      {
        id: 'app-4323-def456',
        title: 'Notas',
        appName: 'notepad',
        pid: 4323,
        thumbnail: '',
        expectedLevel: 'accesibilidad' as const,
      },
    ],
  },
};

describe('selector de aplicaciones', () => {
  beforeEach(() => {
    window.desktopContext = { listApps: vi.fn(async () => inventario), captureApp: vi.fn() } as never;
  });

  it('lista las ventanas con su aplicación y el nivel previsto', async () => {
    render(<AppAttachmentPicker attachedApps={[]} onToggleApp={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Presupuesto 2026 - Excel')).toBeInTheDocument());
    expect(screen.getByText('EXCEL · Documento completo')).toBeInTheDocument();
    expect(screen.getByText('notepad · Texto de la ventana')).toBeInTheDocument();
  });

  it('devuelve la selección con el nivel previsto al marcar', async () => {
    const onToggleApp = vi.fn();
    render(<AppAttachmentPicker attachedApps={[]} onToggleApp={onToggleApp} />);

    await waitFor(() => expect(screen.getByText('Notas')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Notas'));

    expect(onToggleApp).toHaveBeenCalledWith({
      appId: 'app-4323-def456',
      title: 'Notas',
      appName: 'notepad',
      expectedLevel: 'accesibilidad',
    });
  });

  it('muestra un estado vacío explícito cuando no hay ventanas candidatas', async () => {
    window.desktopContext = {
      listApps: vi.fn(async () => ({ success: true, inventory: { ...inventario.inventory, candidates: [] } })),
      captureApp: vi.fn(),
    } as never;

    render(<AppAttachmentPicker attachedApps={[]} onToggleApp={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('No hay aplicaciones abiertas para adjuntar.')).toBeInTheDocument());
  });

  it('ofrece reintentar cuando el inventario falla', async () => {
    const listApps = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'No se pudo enumerar' })
      .mockResolvedValueOnce(inventario);
    window.desktopContext = { listApps, captureApp: vi.fn() } as never;

    render(<AppAttachmentPicker attachedApps={[]} onToggleApp={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('No se pudo enumerar')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByText('Notas')).toBeInTheDocument());
    expect(listApps).toHaveBeenCalledTimes(2);
  });

  it('avisa cuando la capacidad no está disponible en este entorno', async () => {
    delete (window as { desktopContext?: unknown }).desktopContext;

    render(<AppAttachmentPicker attachedApps={[]} onToggleApp={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('El contexto de aplicaciones no está disponible')).toBeInTheDocument());
  });
});

describe('chips de aplicaciones adjuntas', () => {
  const base: AppContextAttachmentState = {
    appId: 'app-4321-abc123',
    title: 'Presupuesto 2026 - Excel',
    appName: 'EXCEL',
    expectedLevel: 'documento',
    status: 'pendiente',
  };

  it('muestra el progreso mientras se lee la aplicación', () => {
    render(<AppAttachmentChips attachedApps={[base]} onRemoveApp={vi.fn()} />);
    expect(screen.getByText('(leyendo...)')).toBeInTheDocument();
  });

  it('declara la fidelidad real y los avisos una vez leída', () => {
    const listo: AppContextAttachmentState = {
      ...base,
      status: 'listo',
      attachment: {
        appId: base.appId,
        title: base.title,
        appName: 'EXCEL',
        level: 'documento',
        source: 'Presupuesto 2026.xlsx',
        text: 'contenido',
        warnings: ['cambios_sin_guardar'],
        charCount: 9,
      },
    };

    render(<AppAttachmentChips attachedApps={[listo]} onRemoveApp={vi.fn()} />);
    expect(screen.getByText('(documento completo, con cambios sin guardar)')).toBeInTheDocument();
  });

  it('distingue una captura de un documento completo', () => {
    const captura: AppContextAttachmentState = {
      ...base,
      status: 'listo',
      attachment: {
        appId: base.appId,
        title: base.title,
        appName: 'EXCEL',
        level: 'captura',
        source: base.title,
        text: '',
        warnings: ['solo_visible'],
        charCount: 0,
      },
    };

    render(<AppAttachmentChips attachedApps={[captura]} onRemoveApp={vi.fn()} />);
    expect(screen.getByText('(captura de pantalla, solo lo visible)')).toBeInTheDocument();
  });

  it('permite quitar una aplicación adjunta', () => {
    const onRemoveApp = vi.fn();
    render(<AppAttachmentChips attachedApps={[base]} onRemoveApp={onRemoveApp} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar aplicación Presupuesto 2026 - Excel' }));
    expect(onRemoveApp).toHaveBeenCalledWith('app-4321-abc123');
  });

  it('no renderiza nada sin aplicaciones adjuntas', () => {
    const { container } = render(<AppAttachmentChips attachedApps={[]} onRemoveApp={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
