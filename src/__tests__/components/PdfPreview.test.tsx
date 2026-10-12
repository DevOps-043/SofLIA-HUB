import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PdfPreview } from '../../components/artifacts/PdfPreview';
import { loadPdf } from '../../components/artifacts/pdf-runtime';
vi.mock('../../components/artifacts/pdf-runtime', () => ({ loadPdf: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
it('dibuja una página, navega, cambia zoom y libera el worker al cerrar', async () => {
  const close = vi.fn(); const cancel = vi.fn();
  const page = (number: number) => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: vi.fn(() => ({ promise: Promise.resolve(), cancel })), getTextContent: async () => ({ items: [{ str: 'Página de prueba ' + number }] }) });
  const getPage = vi.fn(async (number: number) => page(number));
  vi.mocked(loadPdf).mockResolvedValue({ task: { promise: Promise.resolve({ numPages: 2, getPage }) }, close } as never);
  const view = render(<PdfPreview base64="PDF" />);
  expect(await screen.findByText('Página de prueba 1')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Página 1 del PDF' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
  expect(await screen.findByText('Página de prueba 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
  await waitFor(() => expect(screen.getByText('125%')).toBeInTheDocument()); view.unmount();
  expect(close).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalled();
});
it('explica un PDF protegido sin dejar la carga indefinidamente', async () => {
  const error = new Error('Contraseña'); error.name = 'PasswordException';
  vi.mocked(loadPdf).mockResolvedValue({ task: { promise: Promise.reject(error) }, close: vi.fn() } as never);
  render(<PdfPreview base64="PDF" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('protegido con contraseña');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('destruye una inicialización tardía después de cerrar el visor', async () => {
  let finish!: (handle: Awaited<ReturnType<typeof loadPdf>>) => void;
  const close = vi.fn(); vi.mocked(loadPdf).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<PdfPreview base64="PDF" />); view.unmount();
  await act(async () => finish({ task: { promise: Promise.resolve({}) }, close } as never)); expect(close).toHaveBeenCalledOnce();
});
