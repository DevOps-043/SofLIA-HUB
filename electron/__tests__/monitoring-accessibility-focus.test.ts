import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { fetchFocusedAccessibilityTree } from '../monitoring/accessibility-tree';

describe('accesibilidad de la ventana enfocada', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('no lee una ventana del Hub cuando ninguna tiene el foco', async () => {
    const sendCommand = vi.fn();
    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([
      { isFocused: () => false, webContents: { debugger: { sendCommand } } } as unknown as BrowserWindow,
    ]);
    expect(await fetchFocusedAccessibilityTree()).toBeNull();
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('lee la ventana enfocada aunque no sea la primera', async () => {
    const sendCommand = vi.fn(async () => ({ nodes: [{ nodeId: 'raiz', role: { value: 'RootWebArea' }, name: { value: 'Ventana activa' } }] }));
    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([
      { isFocused: () => false } as unknown as BrowserWindow,
      { isFocused: () => true, webContents: { debugger: { isAttached: () => true, sendCommand } } } as unknown as BrowserWindow,
    ]);
    expect(await fetchFocusedAccessibilityTree()).toContain('Ventana activa');
    expect(sendCommand).toHaveBeenCalledWith('Accessibility.getFullAXTree');
  });
});
