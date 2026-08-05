import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

type BrowserDialogProps = {
  title: string;
  eyebrow: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  variant?: 'panel' | 'confirmation';
  closeLabel?: string;
  closeDisabled?: boolean;
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function BrowserDialog(props: BrowserDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const initial = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input:not([disabled])');
      (initial ?? dialogRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape' && !props.closeDisabled) {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`soflia-browser-overlay ${props.variant === 'confirmation' ? 'soflia-browser-overlay--center' : ''}`}
      onKeyDown={handleKeyDown}
      data-testid={`browser-${props.variant ?? 'panel'}-overlay`}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={props.description ? descriptionId : undefined}
        tabIndex={-1}
        className={`soflia-browser-dialog ${props.variant === 'confirmation' ? 'soflia-browser-dialog--confirmation' : 'soflia-browser-dialog--panel'}`}
      >
        <header className="soflia-browser-dialog__header">
          <span className="soflia-browser-dialog__icon" aria-hidden="true">{props.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="soflia-browser-dialog__eyebrow">{props.eyebrow}</span>
            <h2 id={titleId} className="soflia-browser-dialog__title">{props.title}</h2>
            {props.description && <p id={descriptionId} className="soflia-browser-dialog__description">{props.description}</p>}
          </span>
          <button
            type="button"
            aria-label={props.closeLabel ?? 'Cerrar'}
            title={props.closeLabel ?? 'Cerrar'}
            onClick={props.onClose}
            disabled={props.closeDisabled}
            className="soflia-browser-icon-button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="soflia-browser-dialog__body no-scrollbar">{props.children}</div>
        {props.footer && <footer className="soflia-browser-dialog__footer">{props.footer}</footer>}
      </section>
    </div>
  );
}

export function BrowserConfirmDialog(props: {
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <BrowserDialog
      variant="confirmation"
      eyebrow={props.tone === 'primary' ? 'Revisión de permisos' : 'Confirmación requerida'}
      title={props.title}
      description={props.description}
      onClose={() => { if (!props.busy) props.onCancel(); }}
      closeDisabled={props.busy}
      icon={<svg viewBox="0 0 24 24"><path d="M12 3L2.8 19h18.4L12 3zM12 9v4M12 17h.01" /></svg>}
      footer={(
        <>
          <button type="button" className="soflia-browser-button soflia-browser-button--secondary" onClick={props.onCancel} disabled={props.busy}>Cancelar</button>
          <button type="button" data-autofocus className={`soflia-browser-button ${props.tone === 'primary' ? 'soflia-browser-button--primary' : 'soflia-browser-button--danger'}`} onClick={props.onConfirm} disabled={props.busy}>
            {props.busy ? 'Procesando…' : props.confirmLabel}
          </button>
        </>
      )}
    >
      {props.detail && (
        <div className="rounded-2xl border border-danger/15 bg-danger/[0.06] px-4 py-3 text-[13px] leading-relaxed text-secondary dark:text-white/65">
          {props.detail}
        </div>
      )}
    </BrowserDialog>
  );
}
