/** Copia texto literal y respeta los rechazos del puente nativo. */
export async function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof window.computerUse?.clipboardWrite === 'function') {
    try {
      const result: unknown = await window.computerUse.clipboardWrite(text);
      return typeof result === 'object' && result !== null
        && 'success' in result && result.success === true;
    } catch {
      return false;
    }
  }

  if (window.isSecureContext && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // En navegador, la selección permite copiar si la API web no está disponible.
    }
  }

  const focusedElement = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.readOnly = true;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';

  try {
    document.body.appendChild(textArea);
    textArea.focus({ preventScroll: true });
    textArea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textArea.remove();
    if (focusedElement instanceof HTMLElement) focusedElement.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}
