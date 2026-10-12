import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrbGuidanceControls } from '../../components/orb/OrbGuidanceControls';
import { initialGuidanceState } from '../../shared/orb-guidance';

describe('controles de asistencia visual', () => {
  it('pausa, cambia la marca y comprueba el paso con operaciones específicas', () => {
    const control = vi.fn(async () => undefined), check = vi.fn(async () => undefined);
    render(<OrbGuidanceControls state={{ ...initialGuidanceState(), phase: 'practice', instruction: 'Abre Insertar', practice: { title: 'Crear tabla', step: 1, total: 3 } }} error={null} control={control} check={check} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Señalar con' }), { target: { value: 'arrow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar paso' }));
    expect(control).toHaveBeenCalledWith({ action: 'pause' }); expect(control).toHaveBeenCalledWith({ action: 'style', style: 'arrow' }); expect(check).toHaveBeenCalledOnce();
  });
  it('no permite comprobar durante una pausa y mantiene detener disponible', () => {
    const control = vi.fn(async () => undefined);
    render(<OrbGuidanceControls state={{ ...initialGuidanceState(), phase: 'paused', practice: { title: 'Práctica', step: 1, total: 1 } }} error={null} control={control} check={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Comprobar paso' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Detener' })); expect(control).toHaveBeenCalledWith({ action: 'stop' });
  });
});
