import { useEffect, useRef, type ReactNode } from 'react';
import { LiveIcon, type LiveIconName } from '../LiveIcon';

interface StudioDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  descriptionId?: string;
  icon?: LiveIconName;
}

export function StudioDialog({ title, onClose, children, className = '', closeLabel = 'Cerrar configuración', descriptionId, icon }: StudioDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`studio-dialog ${className}`} aria-label={title} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header>
      {icon && <span className="studio-dialog-icon"><LiveIcon name={icon} /></span>}
      <h2>{title}</h2>
      <button type="button" className="studio-icon-button" aria-label={closeLabel} onClick={onClose}><LiveIcon name="close" /></button>
    </header>
    {children}
  </dialog>;
}
