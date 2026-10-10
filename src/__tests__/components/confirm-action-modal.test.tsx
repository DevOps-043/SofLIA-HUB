import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmActionModal } from '../../components/ConfirmActionModal';

describe('opciones de aprobación del comando', () => {
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
