import { describe, expect, it } from 'vitest';
import { isReadOnlyCommand } from '../../services/computer-use/confirmation';

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
});
