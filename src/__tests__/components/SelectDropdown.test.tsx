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
  const view = render(
    <SelectDropdown
      value="default"
      onChange={onChange}
      options={OPTIONS}
      aria-label="Micrófono"
      {...overrides}
    />,
  );
  return { ...view, onChange, trigger: screen.getByRole('combobox', { name: 'Micrófono' }) };
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

  it('SELECT-6: mantiene las opciones en el diálogo nativo y conserva el teclado', () => {
    const onChange = vi.fn();
    render(<dialog open aria-label="Audio del estudio"><SelectDropdown value="default" onChange={onChange} options={OPTIONS} aria-label="Micrófono" /></dialog>);
    const trigger = screen.getByRole('combobox', { name: 'Micrófono' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox').parentElement).toBe(screen.getByRole('dialog'));
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('23');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('conserva la identidad activa cuando se reordenan las opciones antes de confirmar', () => {
    const { trigger, onChange, rerender } = renderSelect();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    rerender(<SelectDropdown value="default" onChange={onChange} options={[OPTIONS[0], OPTIONS[2], OPTIONS[1]]} aria-label="Micrófono" />);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('23');
  });

  it('deriva una activa habilitada al desaparecer la opción explorada', () => {
    const { trigger, onChange, rerender } = renderSelect();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    rerender(<SelectDropdown value="default" onChange={onChange} options={[OPTIONS[0], OPTIONS[2]]} aria-label="Micrófono" />);
    const selected = screen.getByRole('option', { name: OPTIONS[0].label });
    expect(trigger).toHaveAttribute('aria-activedescendant', selected.id);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('default');
  });

  it('no anuncia una opción activa inexistente al vaciar las opciones', () => {
    const { trigger, onChange, rerender } = renderSelect();
    fireEvent.click(trigger);
    rerender(<SelectDropdown value="default" onChange={onChange} options={[]} aria-label="Micrófono" />);
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('una lista totalmente deshabilitada no anuncia ni confirma opción activa', () => {
    const { trigger, onChange } = renderSelect({ options: OPTIONS.map(option => ({ ...option, disabled: true })) });
    fireEvent.click(trigger);
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('vaciar y reponer opciones no reabre una solicitud anterior', () => {
    const { trigger, onChange, rerender } = renderSelect();
    fireEvent.click(trigger);
    rerender(<SelectDropdown value="default" onChange={onChange} options={[]} aria-label="Micrófono" />);
    rerender(<SelectDropdown value="default" onChange={onChange} options={OPTIONS} aria-label="Micrófono" />);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('transmite la etiqueta externa al listbox del portal', () => {
    render(<><span id="campo-audio">Micrófono</span><SelectDropdown value="default" onChange={vi.fn()} options={OPTIONS} aria-labelledby="campo-audio" /></>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Micrófono' }));
    expect(screen.getByRole('listbox', { name: 'Micrófono' })).toBeInTheDocument();
  });

  it('mantiene IDs internos únicos aunque otro control use un sufijo listbox', () => {
    render(<>
      <SelectDropdown id="device" value="default" onChange={vi.fn()} options={OPTIONS} aria-label="Primero" />
      <SelectDropdown id="device-listbox" value="default" onChange={vi.fn()} options={OPTIONS} aria-label="Segundo" />
    </>);
    const trigger = screen.getByRole('combobox', { name: 'Primero' });
    fireEvent.click(trigger);
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toBe(screen.getByRole('listbox'));
  });

  it('el primer Escape cierra el popup y el segundo puede llegar al diálogo padre', () => {
    const outerKey = vi.fn();
    render(<div onKeyDown={outerKey}><SelectDropdown value="default" onChange={vi.fn()} options={OPTIONS} aria-label="Micrófono" /></div>);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(outerKey).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(outerKey).toHaveBeenCalledTimes(1);
  });

  it('cierra al mover el foco fuera del control sin cambiar selección', () => {
    const { trigger, onChange } = renderSelect();
    fireEvent.click(trigger);
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deshabilitar y habilitar no vuelve a abrir el popup anterior', () => {
    const { trigger, onChange, rerender } = renderSelect();
    fireEvent.click(trigger);
    rerender(<SelectDropdown value="default" onChange={onChange} options={OPTIONS} aria-label="Micrófono" disabled />);
    rerender(<SelectDropdown value="default" onChange={onChange} options={OPTIONS} aria-label="Micrófono" />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('explora un prefijo sin confirmar hasta pulsar Enter', () => {
    const { trigger, onChange } = renderSelect();
    fireEvent.keyDown(trigger, { key: 'm' });
    fireEvent.keyDown(trigger, { key: 'i' });
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: OPTIONS[2].label }).id);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('24');
  });

  it('ArrowUp sin selección entra por la última opción habilitada', () => {
    const { trigger, onChange } = renderSelect({ value: 'ausente' });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('24');
  });

  it('salta opciones deshabilitadas con flechas, Home y End sin cambiar valor al explorar', () => {
    const { trigger, onChange } = renderSelect({ options: [OPTIONS[0], { ...OPTIONS[1], disabled: true }, OPTIONS[2]] });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'End' });
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: OPTIONS[2].label }).id);
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: OPTIONS[0].label }).id);
    fireEvent.keyDown(trigger, { key: 'Home' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deshabilitar la opción activa deriva otra habilitada y no confirma la anterior', () => {
    const { trigger, onChange, rerender } = renderSelect();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    rerender(<SelectDropdown value="default" onChange={onChange} options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }, OPTIONS[2]]} aria-label="Micrófono" />);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('default');
  });

  it('prefijos ignoran acentos y caracteres repetidos recorren coincidencias habilitadas', () => {
    const { trigger, onChange } = renderSelect({ value: 'ausente', options: [
      { value: '1', label: 'Árbol' }, { value: '2', label: 'Álbum', disabled: true }, { value: '3', label: 'Arroz' },
    ] });
    fireEvent.keyDown(trigger, { key: 'a' });
    const first = trigger.getAttribute('aria-activedescendant');
    expect(document.getElementById(first!)).toHaveTextContent('Árbol');
    fireEvent.keyDown(trigger, { key: 'a' });
    expect(trigger.getAttribute('aria-activedescendant')).not.toBe(first);
    expect(document.getElementById(trigger.getAttribute('aria-activedescendant')!)).toHaveTextContent('Arroz');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reinicia el prefijo al vencer la ventana sin instalar un timer', () => {
    const { trigger, onChange } = renderSelect();
    const key = (value: string, time: number) => {
      const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'timeStamp', { value: time });
      fireEvent(trigger, event);
    };
    key('m', 1000);
    key('a', 1600);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('23');
  });

  it.each(['ctrlKey', 'metaKey', 'altKey', 'isComposing'])('no consume texto de un atajo o composición: %s', modifier => {
    const { trigger, onChange } = renderSelect();
    expect(fireEvent.keyDown(trigger, { key: 'm', [modifier]: true })).toBe(true);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Enter durante composición no confirma la opción activa', () => {
    const { trigger, onChange } = renderSelect();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it.each([false, true])('Tab permite salir sin seleccionar ni bloquear navegación, Shift=%s', shiftKey => {
    const { trigger, onChange } = renderSelect();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(fireEvent.keyDown(trigger, { key: 'Tab', shiftKey })).toBe(true);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clic exterior cierra y búsqueda sin coincidencias conserva la opción activa', () => {
    const { trigger, onChange } = renderSelect();
    fireEvent.click(trigger);
    const active = trigger.getAttribute('aria-activedescendant');
    fireEvent.keyDown(trigger, { key: 'z' });
    expect(trigger).toHaveAttribute('aria-activedescendant', active);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('vuelve a mostrar la opción activa cuando cambia la geometría del popup', () => {
    const { trigger } = renderSelect();
    fireEvent.click(trigger);
    const menu = screen.getByRole('listbox');
    const active = document.getElementById(trigger.getAttribute('aria-activedescendant')!)!;
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 200, 100));
    vi.spyOn(active, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 400, 200, 36));
    Object.defineProperty(menu, 'clientHeight', { value: 100 });
    fireEvent.resize(window);
    expect(menu.scrollTop).toBe(236);
  });

  it('desplazar la lista no obliga a volver a la opción activa', () => {
    const { trigger } = renderSelect();
    fireEvent.click(trigger);
    const menu = screen.getByRole('listbox');
    menu.scrollTop = 40;
    fireEvent.scroll(menu);
    expect(menu.scrollTop).toBe(40);
  });
});
