import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTextWithFallback } from '../../services/clipboard-service';

const nativeBridge = window.computerUse;
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const secureDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
const execDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

describe('Copia fiable del chat', () => {
  const writeText = vi.fn();
  const execCommand = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockReset().mockResolvedValue(undefined);
    execCommand.mockReset().mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.computerUse = nativeBridge;
    for (const [object, key, descriptor] of [
      [navigator, 'clipboard', clipboardDescriptor],
      [window, 'isSecureContext', secureDescriptor],
      [document, 'execCommand', execDescriptor],
    ] as const) {
      if (descriptor) Object.defineProperty(object, key, descriptor);
      else Reflect.deleteProperty(object, key);
    }
    document.body.replaceChildren();
  });

  it('prefiere la copia nativa y conserva el texto literal', async () => {
    const nativeCopy = vi.spyOn(nativeBridge!, 'clipboardWrite').mockResolvedValue({ success: true });
    const text = '\n  net user "%USERNAME%" *\n\n';
    expect(await copyTextWithFallback(text)).toBe(true);
    expect(nativeCopy).toHaveBeenCalledWith(text);
    expect(writeText).not.toHaveBeenCalled();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it.each([{ success: false }, undefined, { success: 'true' }])('no confirma respuestas nativas fallidas o inválidas: %j', async (response) => {
    vi.spyOn(nativeBridge!, 'clipboardWrite').mockResolvedValue(response);
    expect(await copyTextWithFallback('echo hola')).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('controla el rechazo de la promesa nativa', async () => {
    vi.spyOn(nativeBridge!, 'clipboardWrite').mockRejectedValue(new Error('No disponible'));
    expect(await copyTextWithFallback('echo hola')).toBe(false);
  });

  it('usa el portapapeles web sin puente de escritorio', async () => {
    window.computerUse = undefined;
    expect(await copyTextWithFallback('echo hola')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('echo hola');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('restaura el foco y la selección si la copia web falla', async () => {
    window.computerUse = undefined;
    writeText.mockRejectedValue(new Error('Permiso denegado'));
    const input = document.createElement('input');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Texto seleccionado';
    document.body.append(input, paragraph);
    input.focus();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    expect(window.getSelection()!.toString()).toBe('Texto seleccionado');
    execCommand.mockImplementation(() => {
      expect(document.querySelector('textarea')!.value).toBe('  echo hola\n');
      return true;
    });
    expect(await copyTextWithFallback('  echo hola\n')).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(window.getSelection()!.toString()).toBe('Texto seleccionado');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('limpia el elemento temporal incluso cuando la alternativa falla', async () => {
    window.computerUse = undefined;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    execCommand.mockImplementation(() => { throw new Error('Copia no disponible'); });
    expect(await copyTextWithFallback('echo hola')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
