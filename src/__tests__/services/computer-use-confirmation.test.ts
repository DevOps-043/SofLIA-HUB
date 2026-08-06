import { describe, expect, it, vi } from 'vitest';
import { confirmToolExecution, isReadOnlyCommand, setConfirmationHandler } from '../../services/computer-use/confirmation';

describe('Confirmacion: comandos de solo lectura', () => {
  it('CF-001: comandos de consulta no requieren confirmacion', () => {
    expect(isReadOnlyCommand('dir /s /b "C:\\ProgramData"')).toBe(true);
    expect(isReadOnlyCommand('cmd.exe /c "dir /s /b \\"C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\*Minecraft*\\""')).toBe(true);
    expect(isReadOnlyCommand('where python')).toBe(true);
    expect(isReadOnlyCommand('Get-ChildItem C:\\Users')).toBe(true);
    expect(isReadOnlyCommand('tasklist')).toBe(true);
    expect(isReadOnlyCommand('powershell -NoProfile Get-Process')).toBe(true);
  });

  it('CF-002: comandos mutantes o desconocidos siguen requiriendo confirmacion', () => {
    expect(isReadOnlyCommand('del C:\\archivo.txt')).toBe(false);
    expect(isReadOnlyCommand('rmdir /s /q C:\\carpeta')).toBe(false);
    expect(isReadOnlyCommand('shutdown /s')).toBe(false);
    expect(isReadOnlyCommand('')).toBe(false);
  });

  it('CF-003: encadenamiento o redireccion anulan la garantia de solo lectura', () => {
    expect(isReadOnlyCommand('dir && del C:\\archivo.txt')).toBe(false);
    expect(isReadOnlyCommand('dir > salida.txt')).toBe(false);
    expect(isReadOnlyCommand('dir | findstr algo')).toBe(false);
    expect(isReadOnlyCommand('echo $(rm archivo)')).toBe(false);
    expect(isReadOnlyCommand('type archivo; del archivo')).toBe(false);
  });

  it('CF-004: observar Codex con Computer Use no interrumpe con confirmacion', async () => {
    const confirm = vi.fn(async () => true);
    setConfirmationHandler(confirm);

    await expect(confirmToolExecution('use_computer', {
      task: 'Observa la ventana de Codex y devuelve un resumen verificable.',
      backend: 'desktop',
    }, window.computerUse)).resolves.toBe(true);

    expect(confirm).not.toHaveBeenCalled();
    setConfirmationHandler(null);
  });

  it('CF-005: un envio mediante Computer Use exige HITL antes de iniciar', async () => {
    const confirm = vi.fn(async () => false);
    setConfirmationHandler(confirm);

    await expect(confirmToolExecution('use_computer', {
      task: 'Mándaselo al usuario de Google Chat y envía el resumen ejecutivo.',
      backend: 'browser',
    }, window.computerUse)).resolves.toBe(false);

    expect(confirm).toHaveBeenCalledWith('use_computer', expect.stringContaining('Google Chat'));
    setConfirmationHandler(null);
  });
});
