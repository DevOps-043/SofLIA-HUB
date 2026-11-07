import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, type FormEvent } from 'react';
import userEvent from '@testing-library/user-event';
import { ConfirmActionModal, type ConfirmActionModalProps } from '../../components/ConfirmActionModal';

const nativeMethods = new Map(['showModal', 'close'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeEach(() => {
  // Sólo ciclo de API: jsdom no simula modalidad, focus trap o AX del navegador.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, writable: true, value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); }) });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, writable: true, value: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open'); }) });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, descriptor] of nativeMethods) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
const props = (extra: Partial<ConfirmActionModalProps> = {}): ConfirmActionModalProps => ({
  isOpen: true, toolName: 'execute_command', description: 'Ejecutar comando: prueba ficticia',
  onConfirm: vi.fn(), onCancel: vi.fn(), ...extra,
});

describe('opciones de aprobación del comando', () => {
  it('mueve foco a Cancelar al abrir y usa modalidad nativa', () => {
    render(<ConfirmActionModal {...props()} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });

  it('Escape nativo solicita sólo cancelación y el dueño conserva el cierre', () => {
    const p = props({ onAlways: vi.fn() }); render(<ConfirmActionModal {...p} />);
    const event = new Event('cancel', { cancelable: true, bubbles: false });
    fireEvent(screen.getByRole('dialog'), event);
    expect(event.defaultPrevented).toBe(true); expect(p.onCancel).toHaveBeenCalledOnce();
    expect(p.onConfirm).not.toHaveBeenCalled(); expect(p.onAlways).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });

  it('asocia títulos únicos por instancia sin compartir el ID', () => {
    render(<><ConfirmActionModal {...props()} /><ConfirmActionModal {...props({ toolName: 'delete_item', description: 'Eliminar: archivo ficticio' })} /></>);
    const dialogs = screen.getAllByRole('dialog'), ids = dialogs.map(dialog => dialog.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
    for (const dialog of dialogs) expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)).toBe(within(dialog).getByRole('heading'));
  });

  it.each(['herramienta', 'descripción', 'alternativas', 'identidad'] as const)('renueva foco seguro al cambiar %s', change => {
    const p = props({ requestId: 1 }), view = render(<ConfirmActionModal {...p} />);
    screen.getByRole('button', { name: 'Ejecutar' }).focus();
    const next = change === 'herramienta' ? { toolName: 'delete_item' }
      : change === 'descripción' ? { description: 'Otra solicitud ficticia' }
        : change === 'alternativas' ? { onAlways: vi.fn() } : { requestId: 2 };
    view.rerender(<ConfirmActionModal {...p} {...next} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(p.onConfirm).not.toHaveBeenCalled(); expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('renderizar callbacks nuevos de la misma solicitud conserva foco elegido', () => {
    const p = props({ requestId: 1 }), view = render(<ConfirmActionModal {...p} />);
    const confirm = screen.getByRole('button', { name: 'Ejecutar' }); confirm.focus();
    view.rerender(<ConfirmActionModal {...p} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(confirm).toHaveFocus(); expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  });

  it('cierra el recurso nativo al ocultar/desmontar y lo reabre sin apertura duplicada', () => {
    const p = props(), view = render(<ConfirmActionModal {...p} />);
    view.rerender(<ConfirmActionModal {...p} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
    view.rerender(<ConfirmActionModal {...p} />); view.unmount();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(2);
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(2);
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('StrictMode conserva un diálogo abierto y cleanup cierra todas sus aperturas', () => {
    const p = props(), view = render(<StrictMode><ConfirmActionModal {...p} /></StrictMode>);
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    view.unmount();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(vi.mocked(HTMLDialogElement.prototype.showModal).mock.calls.length);
    expect(p.onConfirm).not.toHaveBeenCalled(); expect(p.onCancel).not.toHaveBeenCalled();
  });

  it.each(['Cancelar', 'Siempre permitir', 'Ejecutar'])('la acción %s no envía un formulario contenedor', name => {
    const submit = vi.fn((event: FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><ConfirmActionModal {...props({ onAlways: vi.fn() })} /></form>);
    fireEvent.click(screen.getByRole('button', { name })); expect(submit).not.toHaveBeenCalled();
  });

  it('el teclado del diálogo no burbujea a shortcuts de fondo', () => {
    const shortcut = vi.fn(); render(<div onKeyDown={shortcut}><ConfirmActionModal {...props()} /></div>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancelar' }), { key: 'Escape' });
    expect(shortcut).not.toHaveBeenCalled();
  });

  it('oculto no abre recursos ni toma foco', () => {
    render(<ConfirmActionModal {...props({ isOpen: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it('restaura explícitamente el invocador al retirar el nodo controlado', () => {
    const opener = document.createElement('button'); opener.textContent = 'Origen'; document.body.append(opener); opener.focus();
    try {
      const p = props(), view = render(<ConfirmActionModal {...p} />);
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
      view.rerender(<ConfirmActionModal {...p} isOpen={false} />); expect(opener).toHaveFocus();
    } finally { opener.remove(); }
  });

  it('un gesto de ratón iniciado en otra solicitud no aprueba la revisión nueva', async () => {
    const user = userEvent.setup(), p = props({ requestId: 1 }), view = render(<ConfirmActionModal {...p} />);
    await user.pointer({ target: screen.getByRole('button', { name: 'Ejecutar' }), keys: '[MouseLeft>]' });
    view.rerender(<ConfirmActionModal {...p} requestId={2} />);
    await user.pointer({ target: screen.getByRole('button', { name: 'Ejecutar' }), keys: '[/MouseLeft]' });
    expect(p.onConfirm).not.toHaveBeenCalled(); expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('el contenido que requiere scroll comienza por su título enfocable', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    const p = props({ description: 'Contenido ficticio extenso '.repeat(30) });
    render(<ConfirmActionModal {...p} />);
    expect(screen.getByRole('heading')).toHaveFocus(); expect(p.onConfirm).not.toHaveBeenCalled();
  });

  it('retirar el invocador no rompe el cierre ni enfoca una acción sustituta', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const p = props(), view = render(<ConfirmActionModal {...p} />); opener.remove();
    expect(() => view.unmount()).not.toThrow(); expect(document.activeElement).toBe(document.body);
    expect(p.onConfirm).not.toHaveBeenCalled(); expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('ofrece cancelar, ejecutar una vez y siempre cuando el servicio lo permite', () => {
    const onConfirm = vi.fn(), onAlways = vi.fn(), onCancel = vi.fn();
    render(<ConfirmActionModal isOpen toolName="execute_command" description="Ejecutar comando: npm run build" onConfirm={onConfirm} onAlways={onAlways} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siempre permitir' }));
    expect(onAlways).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it('no ofrece aprobación permanente para una acción sensible', () => {
    render(<ConfirmActionModal isOpen toolName="execute_command" description="Ejecutar comando: setx PATH x" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Siempre permitir' })).toBeNull();
  });
});
