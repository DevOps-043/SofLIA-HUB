import { useEffect, useRef, type ReactNode } from 'react';
import { LiveIcon } from '../LiveIcon';

export function StudioDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="studio-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}><header><h2>{title}</h2><button type="button" className="studio-icon-button" aria-label="Cerrar configuración" onClick={onClose}><LiveIcon name="close" /></button></header>{children}</dialog>;
}
