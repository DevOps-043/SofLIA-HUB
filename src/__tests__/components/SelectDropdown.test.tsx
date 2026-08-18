import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SelectDropdown from '../../components/ui/SelectDropdown';

const OPTIONS = [
  { value: 'default', label: 'Predeterminado del sistema' },
  { value: '23', label: 'Auriculares HAYLOU S30', description: 'Predeterminado del sistema' },
  { value: '24', label: 'Micrófono (High Definition Audio)' },
];

function renderSelect(overrides: Partial<React.ComponentProps<typeof SelectDropdown>> = {}) {
  const onChange = vi.fn();
  render(
    <SelectDropdown
      value="default"
      onChange={onChange}
      options={OPTIONS}
      aria-label="Micrófono"
      {...overrides}
    />,
  );
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Micrófono' }) };
}

describe('SelectDropdown', () => {
  it('SELECT-1: expone el patron combobox/listbox y marca la opcion seleccionada', () => {
    const { trigger } = renderSelect();

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    // El trigger conserva el foco y apunta a la opcion activa.
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('SELECT-2: se opera con teclado y devuelve el valor elegido', () => {
    const { onChange, trigger } = renderSelect();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // abre en la seleccion actual
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // segunda opcion
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('23');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('SELECT-3: Escape cierra sin cambiar el valor', () => {
    const { onChange, trigger } = renderSelect();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('SELECT-4: deshabilitado no abre el menu', () => {
    const { trigger } = renderSelect({ disabled: true });

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('SELECT-5: el menu se renderiza fuera del contenedor con overflow (portal)', () => {
    const { trigger } = renderSelect();
    fireEvent.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(listbox.parentElement).toBe(document.body);
  });
});
