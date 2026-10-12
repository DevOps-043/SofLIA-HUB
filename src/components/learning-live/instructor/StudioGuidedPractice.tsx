import { useState, type FormEvent } from 'react';
import { StudioDialog } from './StudioDialog';
import { LiveIcon } from '../LiveIcon';
import { orbGuidanceService } from '../../../services/orb-guidance-service';
import { practiceDefinitionSchema, type PracticeDefinition } from '../../../shared/orb-guidance';

const emptyStep = () => ({ instruction: '', targetText: '', expectedText: '' });

/** Ensayo en el escritorio del instructor; no concede control sobre el grupo. */
export function StudioGuidedPractice() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState<PracticeDefinition['steps']>([emptyStep()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const available = orbGuidanceService.available();
  const update = (index: number, key: keyof PracticeDefinition['steps'][number], value: string) => {
    setSteps(previous => previous.map((step, current) => current === index ? { ...step, [key]: value } : step));
  };
  async function start(event: FormEvent) {
    event.preventDefault();
    const parsed = practiceDefinitionSchema.safeParse({ title, steps });
    if (!parsed.success) { setMessage('Completa el título y los tres campos de cada paso.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await orbGuidanceService.startPractice(parsed.data);
      if (!result.success) { setMessage(result.error ?? 'No se pudo iniciar la práctica.'); return; }
      setOpen(false); setMessage('Práctica local iniciada. Abre la aplicación indicada y sigue a SofLIA.');
    } catch { setMessage('La asistencia de escritorio no está disponible.'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="studio-activity-card" disabled={!available} onClick={() => setOpen(true)}>
      <span className="studio-tool-icon"><LiveIcon name="book" /></span><span><strong>Práctica con SofLIA</strong><small>Ensaya pasos guiados en tu escritorio.</small></span><LiveIcon name="plus" />
    </button>
    {message && !open && <p className="studio-muted" role="status">{message}</p>}
    {open && <StudioDialog title="Preparar práctica guiada" onClose={() => { if (!busy) setOpen(false); }}>
      <p className="studio-muted">SofLIA señala controles en tu computadora y comprueba el resultado de cada paso.</p>
      <form onSubmit={start}>
        <label>Título de la práctica<input required maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
        {steps.map((step, index) => <fieldset key={index}>
          <legend>Paso {index + 1}</legend>
          <label>Instrucción<input required maxLength={300} value={step.instruction} onChange={event => update(index, 'instruction', event.target.value)} placeholder="Abre el menú Insertar" /></label>
          <label>Texto del control que SofLIA señalará<input required maxLength={300} value={step.targetText} onChange={event => update(index, 'targetText', event.target.value)} placeholder="Insertar" /></label>
          <label>Texto visible que confirma el resultado<input required maxLength={300} value={step.expectedText} onChange={event => update(index, 'expectedText', event.target.value)} placeholder="Tabla dinámica" /></label>
          {steps.length > 1 && <button type="button" disabled={busy} onClick={() => setSteps(previous => previous.filter((_, current) => current !== index))}>Quitar paso {index + 1}</button>}
        </fieldset>)}
        <button type="button" disabled={steps.length >= 20 || busy} onClick={() => setSteps(previous => [...previous, emptyStep()])}>Añadir paso</button>
        <button type="submit" className="studio-primary-button" disabled={busy}>{busy ? 'Preparando…' : 'Iniciar práctica local'}</button>
        <p role="status">{message}</p>
      </form>
    </StudioDialog>}
  </>;
}
