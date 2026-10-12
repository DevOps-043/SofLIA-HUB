import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from '../../components/chat/markdown-renderer/CodeBlock';
import { MarkdownRenderer } from '../../components/chat/markdown-renderer/MarkdownRenderer';
import { QuoteBlock } from '../../components/chat/markdown-renderer/QuoteBlock';

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Bloques de código de SoflIA', () => {
  it('muestra colores y copia el código original sin etiquetas HTML', async () => {
    const copy = vi.spyOn(window.computerUse!, 'clipboardWrite').mockResolvedValue({ success: true });
    const code = '@echo off\n\nnet user "%USERNAME%" *';
    const { container } = render(<CodeBlock language="bat" code={code} />);
    expect(container.querySelector('.hljs-built_in')).toBeInTheDocument();
    expect(container.querySelector('code')!.textContent).toBe(code);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(await screen.findByText('Copiado')).toBeInTheDocument();
    expect(copy).toHaveBeenCalledWith(code);
  });

  it('espera la confirmación y evita copias simultáneas', async () => {
    let resolveCopy!: (result: { success: boolean }) => void;
    const copy = vi.spyOn(window.computerUse!, 'clipboardWrite').mockImplementation(() => (
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
    await act(async () => resolveCopy({ success: true }));
    expect(screen.getByText('Copiado')).toBeInTheDocument();
  });

  it('informa del fallo y permite reintentar', async () => {
    const copy = vi.spyOn(window.computerUse!, 'clipboardWrite')
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });
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
    vi.spyOn(window.computerUse!, 'clipboardWrite').mockResolvedValue({ success: true });
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
    vi.spyOn(window.computerUse!, 'clipboardWrite').mockResolvedValue({ success: true });
    render(<form onSubmit={submit}><CodeBlock language="bat" code="echo hola" /></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await screen.findByText('Copiado');
    expect(submit).not.toHaveBeenCalled();
  });

  it('conserva líneas vacías iniciales y finales del bloque Markdown', async () => {
    const copy = vi.spyOn(window.computerUse!, 'clipboardWrite').mockResolvedValue({ success: true });
    const { container } = render(<MarkdownRenderer text={'```bat\n\n\n  echo hola\n\n```'} />);
    expect(container.querySelector('code')!.textContent).toBe('\n\n  echo hola\n');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await screen.findByText('Copiado');
    expect(copy).toHaveBeenCalledWith('\n\n  echo hola\n');
  });

  it('mantiene el estado de copia mientras crece la respuesta', async () => {
    vi.spyOn(window.computerUse!, 'clipboardWrite').mockResolvedValue({ success: true });
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

  it('reutiliza la copia nativa en las citas del chat', async () => {
    const copy = vi.spyOn(window.computerUse!, 'clipboardWrite').mockResolvedValue({ success: true });
    render(<QuoteBlock rawText="Texto de la cita">Texto de la cita</QuoteBlock>);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar cita' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(copy).toHaveBeenCalledWith('Texto de la cita');
  });
});
