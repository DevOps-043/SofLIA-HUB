import { LiveIcon } from '../LiveIcon';

/** Conserva escritura y flechas de teclado con botones del diseño de SofLIA. */
export function StudioNumberField({ label, value, onChange, min, max, disabled = false, required = false, allowEmpty = false, compact = false }: {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number;
  disabled?: boolean; required?: boolean; allowEmpty?: boolean; compact?: boolean;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return <div className={`studio-number-field ${compact ? 'is-compact' : ''}`}>
    <button type="button" aria-label={`Reducir ${label.toLowerCase()}`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))}><span aria-hidden="true">−</span></button>
    <input type="number" aria-label={label} min={min} max={max} required={required} disabled={disabled} value={allowEmpty && value < min ? '' : value} onChange={(event) => onChange(allowEmpty && event.target.value === '' ? 0 : clamp(Number(event.target.value) || min))} />
    <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))}><LiveIcon name="plus" /></button>
  </div>;
}
