import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from '../../components/chat/markdown-renderer/CodeBlock';
import { MarkdownRenderer } from '../../components/chat/markdown-renderer/MarkdownRenderer';
import { QuoteBlock } from '../../components/chat/markdown-renderer/QuoteBlock';

const writeText = vi.fn<(text: string) => Promise<void>>();
const descriptors = [
  [navigator, 'clipboard', Object.getOwnPropertyDescriptor(navigator, 'clipboard')],
  [window, 'isSecureContext', Object.getOwnPropertyDescriptor(window, 'isSecureContext')],
  [document, 'execCommand', Object.getOwnPropertyDescriptor(document, 'execCommand')],
] as const;

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) });
});

afterEach(() => {
  cleanup();
  for (const [object, key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else Reflect.deleteProperty(object, key);
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Bloques de código de SoflIA', () => {
  it('muestra colores y copia el código original sin etiquetas HTML', async () => {
    const copy = writeText;
    const code = '@echo off\n\nnet user "%USERNAME%" *';
    const { container } = render(<CodeBlock language="bat" code={code} />);
    expect(container.querySelector('.hljs-built_in')).toBeInTheDocument();
    expect(container.querySelector('code')!.textContent).toBe(code);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(await screen.findByText('Copiado')).toBeInTheDocument();
    expect(copy).toHaveBeenCalledWith(code);
  });

  it('espera la confirmación y evita copias simultáneas', async () => {
    let resolveCopy!: () => void;
    const copy = writeText.mockImplementation(() => (
      new Promise((resolve) => { resolveCopy = resolve; })
    ));
    render(<CodeBlock language="cmd" code="echo hola" />);
    const button = screen.getByRole('button', { name: 'Copiar código' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByText('Copiando…')).toBeInTheDocument();
    expect(screen.queryByText('Copiado')).not.toBeInTheDocument();
    expect(copy).toHaveBeenCalledTimes(1);
    await act(async () => resolveCopy());
    expect(screen.getByText('Copiado')).toBeInTheDocument();
  });

  it('informa del fallo y permite reintentar', async () => {
    const copy = writeText
      .mockRejectedValueOnce(new Error('Permiso denegado'))
      .mockResolvedValueOnce(undefined);
    render(<CodeBlock language="bat" code="echo hola" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo copiar');
    expect(screen.queryByText('Copiado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(await screen.findByText('Copiado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(copy).toHaveBeenCalledTimes(2);
  });

  it('restablece la etiqueta y limpia el temporizador al desmontar', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<CodeBlock language="bat" code="echo hola" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copiar código' })));
    expect(screen.getByText('Copiado')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('Copiar')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copiar código' })));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('no envía formularios al copiar', async () => {
    const submit = vi.fn();
    render(<form onSubmit={submit}><CodeBlock language="bat" code="echo hola" /></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await screen.findByText('Copiado');
    expect(submit).not.toHaveBeenCalled();
  });

  it('conserva líneas vacías iniciales y finales del bloque Markdown', async () => {
    const copy = writeText;
    const { container } = render(<MarkdownRenderer text={'```bat\n\n\n  echo hola\n\n```'} />);
    expect(container.querySelector('code')!.textContent).toBe('\n\n  echo hola\n');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await screen.findByText('Copiado');
    expect(copy).toHaveBeenCalledWith('\n\n  echo hola\n');
  });

  it('mantiene el estado de copia mientras crece la respuesta', async () => {
    const { rerender } = render(<MarkdownRenderer text={'```bat\necho hola'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await screen.findByText('Copiado');
    rerender(<MarkdownRenderer text={'```bat\necho hola\npause\n```'} />);
    expect(screen.getByText('Copiado')).toBeInTheDocument();
  });

  it('mantiene la prosa ajustada y el código desconocido como texto seguro', () => {
    const { container, rerender } = render(<CodeBlock language="prompt" code="<img onerror=x>" />);
    expect(container.querySelector('code')).toHaveClass('whitespace-pre-wrap');
    expect(container.querySelector('img')).toBeNull();
    rerender(<CodeBlock language="desconocido" code="<script>x</script>" />);
    expect(container.querySelector('code')).toHaveClass('whitespace-pre');
    expect(container.querySelector('script')).toBeNull();
  });

  it('reutiliza el portapapeles del documento en las citas del chat', async () => {
    const copy = writeText;
    render(<QuoteBlock rawText="Texto de la cita">Texto de la cita</QuoteBlock>);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar cita' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(copy).toHaveBeenCalledWith('Texto de la cita');
  });
});
