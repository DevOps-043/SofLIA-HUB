import { useEffect, useRef, useState } from 'react';
import { validateOrganizationImage } from '../../../services/org/settings-contract';

export function OrganizationImageField({ label, value, onUrl, onFile, onProcessing, disabled }: {
  label: string; value: string; onUrl: (value: string) => void; onFile: (file?: File) => void; onProcessing: (value: boolean) => void; disabled: boolean;
}) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const objectUrl = useRef('');
  const revision = useRef(0);
  const active = useRef(true);
  const release = () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; };
  useEffect(() => { active.current = true; return () => { active.current = false; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }; }, []);

  return <div className="organization-image-field">
    <div className="organization-image-preview">
      {preview || value ? <img src={preview || value} alt={`Vista previa de ${label.toLowerCase()}`} /> : <span>Sin imagen</span>}
    </div>
    <label className="organization-field">
      <span>{label}</span>
      <input type="url" value={value} placeholder="https://…" maxLength={2048} disabled={disabled} onChange={event => {
        revision.current++; release(); setPreview(''); setError(''); onProcessing(false); onFile(undefined); onUrl(event.target.value);
      }} />
    </label>
    <label className="organization-upload">
      <span>Subir {label.toLowerCase()}</span>
      <input className="sr-only" type="file" aria-label={`Subir ${label.toLowerCase()}`} accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const ownRevision = ++revision.current;
        onProcessing(true);
        try {
          await validateOrganizationImage(file);
          const bitmap = await createImageBitmap(file);
          const tooLarge = bitmap.width > 4096 || bitmap.height > 4096;
          bitmap.close();
          if (tooLarge) throw new Error('La imagen debe medir como máximo 4096 × 4096 píxeles.');
          if (!active.current || ownRevision !== revision.current) return;
          release(); objectUrl.current = URL.createObjectURL(file); setPreview(objectUrl.current);
          setError(''); onUrl(''); onFile(file);
        } catch (cause) {
          if (active.current && ownRevision === revision.current) setError(cause instanceof Error ? cause.message : 'No se pudo abrir la imagen.');
        } finally {
          if (active.current && ownRevision === revision.current) onProcessing(false);
        }
      }} />
    </label>
    <p className="text-xs text-secondary">PNG, JPEG o WebP · Hasta 2 MB</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
