import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAttachmentPreparation } from '../../adapters/desktop_ui/chat-ui/useAttachmentPreparation';

describe('Preparación del turno', () => {
  it('dos clics síncronos ejecutan una preparación y muestran estado ocupado', async () => {
    const { result } = renderHook(() => useAttachmentPreparation('chat-a'));
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    let first!: Promise<void>;
    act(() => { first = result.current.run(task); void result.current.run(task); });
    expect(task).toHaveBeenCalledTimes(1); expect(result.current.busy).toBe(true);
    await act(async () => { finish(); await first; });
    expect(result.current.busy).toBe(false);
  });
  it('cancelar preserva el borrador y no presenta errores tardíos', async () => {
    const { result } = renderHook(() => useAttachmentPreparation('chat-a'));
    let reject!: (value: Error) => void; let signal!: AbortSignal;
    let pending!: Promise<void>;
    act(() => { pending = result.current.run((value) => { signal = value; return new Promise((_, fail) => { reject = fail; }); }); });
    act(() => result.current.cancel());
    await act(async () => { reject(new Error('Tardío')); await pending; });
    expect(signal.aborted).toBe(true); expect(result.current.error).toBeNull(); expect(result.current.busy).toBe(false);
  });
  it('cambiar conversación, identidad o permisos invalida el trabajo y desmontar cancela', () => {
    const { result, rerender, unmount } = renderHook(({ key }) => useAttachmentPreparation(key), { initialProps: { key: 'a' } });
    let first!: AbortSignal; let second!: AbortSignal;
    act(() => { void result.current.run((signal) => { first = signal; return new Promise(() => undefined); }); });
    rerender({ key: 'b' }); expect(first.aborted).toBe(true); expect(result.current.busy).toBe(false);
    act(() => { void result.current.run((signal) => { second = signal; return new Promise(() => undefined); }); });
    unmount(); expect(second.aborted).toBe(true);
  });
  it('un fallo permite corregir el adjunto y reintentar', async () => {
    const { result } = renderHook(() => useAttachmentPreparation('a'));
    await act(async () => { await result.current.run(async () => { throw new Error('Selecciona de nuevo'); }); });
    expect(result.current.error).toBe('Selecciona de nuevo');
    await act(async () => { await result.current.run(async () => undefined); });
    expect(result.current.error).toBeNull();
  });
});
