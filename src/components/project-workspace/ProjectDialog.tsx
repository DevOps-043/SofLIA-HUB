import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ProjectDialog({ title, onClose, children, className = '', closeDisabled = false }: { title: string; onClose(): void; children: ReactNode; className?: string; closeDisabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement);
  useEffect(() => {
    const node = dialog.current, previous = previousFocus.current;
    if (node && !node.open) { if (node.showModal) node.showModal(); else node.setAttribute('open', ''); }
    node?.querySelector<HTMLElement>('[autofocus], [data-dialog-autofocus]')?.focus();
    return () => { node?.close?.(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} data-native-browser-overlay className={`project-resource-dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!closeDisabled) onClose(); }}>
    <header><h2>{title}</h2><button type="button" aria-label="Cerrar ventana" disabled={closeDisabled} onClick={onClose}>×</button></header>
    <div className="project-resource-dialog-body custom-scrollbar">{children}</div>
  </dialog>, document.body);
}
