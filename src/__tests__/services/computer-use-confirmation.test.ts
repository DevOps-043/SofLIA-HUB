import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { confirmToolExecution, isReadOnlyCommand, setConfirmationHandler } from '../../services/computer-use/confirmation';
import { setUserPreferenceScope } from '../../services/user-scope';
import { canRememberCommand } from '../../shared/command-approval';
import { clearCommandApprovals } from '../../services/computer-use/command-approvals';

describe('Confirmacion: comandos de solo lectura', () => {
  beforeEach(() => {
    localStorage.clear();
    setUserPreferenceScope('usuario-a');
    vi.stubGlobal('crypto', webcrypto);
  });
  afterEach(() => { setConfirmationHandler(null); setUserPreferenceScope(null); vi.unstubAllGlobals(); });
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
    expect(isReadOnlyCommand('Get-Process -Name (Stop-Process -Id 10)')).toBe(false);
    expect(isReadOnlyCommand('ipconfig /release')).toBe(false);
    expect(isReadOnlyCommand('powershell -File "Get-Process .ps1"')).toBe(false);
    expect(isReadOnlyCommand('powershell -f Get-Process')).toBe(false);
  });

  it('mover y organizar archivos no interrumpe con confirmación', async () => {
    const confirm = vi.fn(async () => false);
    setConfirmationHandler(confirm);
    for (const tool of ['organize_files', 'batch_move_files', 'move_item']) {
      await expect(confirmToolExecution(tool, {}, undefined)).resolves.toBe(true);
    }
    expect(confirm).not.toHaveBeenCalled();
  });

  it('Siempre permitir persiste una huella exacta por usuario, herramienta y carpeta', async () => {
    const confirm = vi.fn(async () => 'always' as const);
    setConfirmationHandler(confirm);
    const args = { command: 'npm run build', working_directory: 'C:\\proyecto' };
    await confirmToolExecution('run_background_command', args, undefined);
    expect(confirm).toHaveBeenCalledWith('run_background_command', expect.any(String), { allowAlways: true });
    const stored = localStorage.getItem('soflia:command-approvals:v1__usuario-a');
    expect(stored).toMatch(/[a-f0-9]{64}/);
    expect(stored).not.toContain('npm');
    confirm.mockClear();
    await confirmToolExecution('run_background_command', args, undefined);
    expect(confirm).not.toHaveBeenCalled();
    await confirmToolExecution('run_background_command', { ...args, command: 'npm run test' }, undefined);
    await confirmToolExecution('run_background_command', { ...args, working_directory: 'C:\\otro' }, undefined);
    await confirmToolExecution('execute_command', args, undefined);
    setUserPreferenceScope('usuario-b');
    await confirmToolExecution('run_background_command', args, undefined);
    expect(confirm).toHaveBeenCalledTimes(4);
  });

  it.each([
    'setx PATH "C:\\algo"', '$env:PATH = "C:\\algo"',
    '[Environment]::SetEnvironmentVariable("PATH", "x", "Machine")',
    'Set-Item Env:PATH "x"', 'reg add HKCU\\Environment',
    'npm run build; setx PATH x', 'powershell -EncodedCommand abcdefgh',
    'Remove-Item C:\\datos -Recurse', 'echo (Remove-Item C:\\datos)',
    'python -c "cambiar_entorno"', 'powershell -File cambiar-entorno.ps1',
    'schtasks /create /tn tarea /tr comando', 'powercfg /change standby-timeout-ac 0',
    'powershell -e ZQBjAGgAbwAgAG8AawA=', 'pwsh -en ZQBjAGgAbwAgAG8AawA=',
    'powershell -ec ZQBjAGgAbwAgAG8AawA=', 'powershell \u2013ec ZQBjAGgAbwAgAG8AawA=',
    'powershell "-e" ZQBjAGgAbwAgAG8AawA=', "powershell '-en' ZQBjAGgAbwAgAG8AawA=", 'powershell -"ec" ZQBjAGgAbwAgAG8AawA=',
  ])('un cambio sensible nunca permite recordar: %s', async command => {
    expect(canRememberCommand(command)).toBe(false);
    const confirm = vi.fn(async () => true);
    setConfirmationHandler(confirm);
    await confirmToolExecution('execute_command', { command }, undefined);
    await confirmToolExecution('execute_command', { command }, undefined);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledWith('execute_command', expect.any(String));
  });

  it('cancelación, fallo de almacenamiento y cambio de usuario no guardan aprobación', async () => {
    const confirm = vi.fn(async () => false);
    setConfirmationHandler(confirm);
    await expect(confirmToolExecution('execute_command', { command: 'npm run build' }, undefined)).resolves.toBe(false);
    expect(localStorage.length).toBe(0);
    setConfirmationHandler(async () => { setUserPreferenceScope('otro'); return 'always'; });
    await expect(confirmToolExecution('execute_command', { command: 'npm run build' }, undefined)).resolves.toBe(false);
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('storage no disponible'); });
    const always = vi.fn(async () => 'always' as const);
    setConfirmationHandler(always);
    await expect(confirmToolExecution('execute_command', { command: 'npm run build' }, undefined)).resolves.toBe(true);
    await confirmToolExecution('execute_command', { command: 'npm run build' }, undefined);
    expect(always).toHaveBeenCalledTimes(2);
    write.mockRestore();
  });

  it('sin handler ni API una acción sensible falla cerrada', async () => {
    setConfirmationHandler(null);
    await expect(confirmToolExecution('execute_command', { command: 'setx PATH x' }, undefined)).resolves.toBe(false);
  });

  it('revocar elimina sólo las aprobaciones del usuario activo', async () => {
    const confirm = vi.fn(async () => 'always' as const);
    setConfirmationHandler(confirm);
    const args = { command: 'npm run build' };
    await confirmToolExecution('execute_command', args, undefined);
    setUserPreferenceScope('usuario-b');
    await confirmToolExecution('execute_command', args, undefined);
    expect(clearCommandApprovals()).toBe(true);
    confirm.mockClear();
    await confirmToolExecution('execute_command', args, undefined);
    expect(confirm).toHaveBeenCalledOnce();
    setUserPreferenceScope('usuario-a');
    confirm.mockClear();
    await confirmToolExecution('execute_command', args, undefined);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('una aprobación tardía después de detener el turno no permite ni recuerda el comando', async () => {
    const controller = new AbortController();
    let decide!: (decision: 'always') => void;
    const handler = vi.fn(() => new Promise<'always'>(resolve => { decide = resolve; }));
    setConfirmationHandler(handler);
    const pending = confirmToolExecution('execute_command', { command: 'npm run build' }, undefined, controller.signal);
    await vi.waitFor(() => expect(handler).toHaveBeenCalled());
    controller.abort();
    decide('always');
    await expect(pending).resolves.toBe(false);
    expect(localStorage.length).toBe(0);
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
