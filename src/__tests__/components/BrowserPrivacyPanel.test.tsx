import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserPrivacyPanel } from '../../components/browser/BrowserPrivacyPanel';

function mockApi(clearBrowsingData: ReturnType<typeof vi.fn>) {
  window.integratedBrowser = { clearBrowsingData } as never;
}

function okSummary(results: unknown[] = []) {
  return { success: true, summary: { range: 'todo', results } };
}

describe('panel de privacidad del navegador', () => {
  let clearBrowsingData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearBrowsingData = vi.fn(async () => okSummary());
    mockApi(clearBrowsingData);
  });

  const confirmar = () => fireEvent.click(screen.getByRole('button', { name: 'Borrar datos' }));

  // Con el diálogo abierto hay dos botones homónimos; el del diálogo es el último.
  const confirmarEnDialogo = () => {
    const botones = screen.getAllByRole('button', { name: 'Borrar datos' });
    fireEvent.click(botones[botones.length - 1]);
  };

  it('propone las tres categorías básicas marcadas, como Chrome', () => {
    render(<BrowserPrivacyPanel />);

    expect(screen.getByRole('checkbox', { name: /Historial de navegación/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Cookies y datos de sitios/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Archivos en caché/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Contraseñas guardadas/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Permisos por sitio/ })).not.toBeChecked();
  });

  it('exige confirmación antes de borrar nada', () => {
    render(<BrowserPrivacyPanel />);
    confirmar();

    expect(clearBrowsingData).not.toHaveBeenCalled();
    expect(screen.getByText('Borrar datos de navegación')).toBeInTheDocument();
  });

  it('envía las categorías marcadas y el intervalo al confirmar', async () => {
    render(<BrowserPrivacyPanel />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Archivos en caché/ }));
    fireEvent.change(screen.getByLabelText('Intervalo de tiempo'), { target: { value: 'ultima-hora' } });
    confirmar();
    confirmarEnDialogo();

    await waitFor(() => expect(clearBrowsingData).toHaveBeenCalledWith({
      categories: ['historial', 'cookies'],
      range: 'ultima-hora',
    }));
  });

  it('advierte que el intervalo no alcanza a cookies ni caché', () => {
    render(<BrowserPrivacyPanel />);

    expect(screen.queryByText(/El intervalo solo se aplica al historial/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Intervalo de tiempo'), { target: { value: 'ultimo-dia' } });

    expect(screen.getByText(/El intervalo solo se aplica al historial/)).toBeInTheDocument();
    expect(screen.getAllByText('Se borra por completo: el intervalo no aplica a este dato.')).toHaveLength(2);
  });

  it('no advierte nada cuando solo se pide el historial, que sí respeta el intervalo', () => {
    render(<BrowserPrivacyPanel />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Cookies y datos de sitios/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Archivos en caché/ }));
    fireEvent.change(screen.getByLabelText('Intervalo de tiempo'), { target: { value: 'ultimo-dia' } });

    expect(screen.queryByText(/El intervalo solo se aplica al historial/)).not.toBeInTheDocument();
  });

  it('no deja borrar sin ninguna categoría marcada', () => {
    render(<BrowserPrivacyPanel />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Historial de navegación/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cookies y datos de sitios/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Archivos en caché/ }));

    expect(screen.getByRole('button', { name: 'Borrar datos' })).toBeDisabled();
  });

  it('resume lo borrado declarando cuándo se ignoró el intervalo', async () => {
    clearBrowsingData = vi.fn(async () => ({
      success: true,
      summary: {
        range: 'ultima-hora',
        results: [
          { category: 'historial', cleared: true, removed: 7, ignoredRange: false },
          { category: 'cookies', cleared: true, ignoredRange: true },
        ],
      },
    }));
    mockApi(clearBrowsingData);
    render(<BrowserPrivacyPanel />);

    confirmar();
    confirmarEnDialogo();

    await waitFor(() => expect(screen.getByText(/7 elementos/)).toBeInTheDocument());
    expect(screen.getByText(/borrado, sin acotar al intervalo/)).toBeInTheDocument();
  });

  it('muestra el fallo aislado de una categoría sin ocultar el resto', async () => {
    clearBrowsingData = vi.fn(async () => ({
      success: true,
      summary: {
        range: 'todo',
        results: [
          { category: 'cookies', cleared: false, ignoredRange: false, error: 'la partición está ocupada' },
          { category: 'historial', cleared: true, removed: 2, ignoredRange: false },
        ],
      },
    }));
    mockApi(clearBrowsingData);
    render(<BrowserPrivacyPanel />);

    confirmar();
    confirmarEnDialogo();

    await waitFor(() =>
      expect(screen.getByText(/no se pudo borrar \(la partición está ocupada\)/)).toBeInTheDocument());
    expect(screen.getByText(/2 elementos/)).toBeInTheDocument();
  });

  it('informa un error del canal sin dejar el diálogo colgado', async () => {
    clearBrowsingData = vi.fn(async () => ({ success: false, error: 'sender_denied' }));
    mockApi(clearBrowsingData);
    render(<BrowserPrivacyPanel />);

    confirmar();
    confirmarEnDialogo();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('sender_denied'));
  });
});
