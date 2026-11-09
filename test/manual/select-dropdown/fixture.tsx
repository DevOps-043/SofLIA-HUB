import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SelectDropdown, { type SelectDropdownOption } from '../../../src/components/ui/SelectDropdown';
import '../../../src/index.css';

const options: SelectDropdownOption[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'headphones', label: 'Auriculares de prueba' },
  { value: 'mic', label: 'Micrófono de prueba' },
];

declare global {
  interface Window {
    selectSmoke?: { open(): void; reorder(): void; many(): void };
  }
}

export function Fixture() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState(options);
  const [value, setValue] = useState('system');
  const [changes, setChanges] = useState<string[]>([]);
  useEffect(() => {
    const open = () => { if (!dialog.current?.open) dialog.current?.showModal(); };
    window.selectSmoke = {
      open,
      reorder: () => setItems([options[0], options[2], options[1]]),
      many: () => setItems(Array.from({ length: 30 }, (_, index) => ({ value: `opcion-${index}`, label: `Opción ${index + 1}` }))),
    };
    open();
    return () => { delete window.selectSmoke; };
  }, []);
  return <dialog ref={dialog} aria-labelledby="dialog-title" style={{ padding: 12, width: 'min(20rem, calc(100vw - 2rem))', overflow: 'visible' }}>
    <div style={{ display: 'grid', gap: 8 }}>
      <h1 id="dialog-title">Configuración de prueba</h1>
      <span id="audio-label">Dispositivo de prueba</span>
      <SelectDropdown id="device" value={value} placeholder="Selecciona una opción" onChange={next => { setValue(next); setChanges(current => [...current, next]); }} options={items} aria-labelledby="audio-label" />
      <button id="after" type="button">Siguiente control</button>
      <output id="changes" aria-label="Cambios confirmados">{changes.join(',')}</output>
    </div>
  </dialog>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
