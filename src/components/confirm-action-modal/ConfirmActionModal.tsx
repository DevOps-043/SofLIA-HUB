import { useId, useLayoutEffect, useRef } from 'react';
import { ActionDetail } from './ActionDetail';
import { getActionTone } from './action-tone';
import { DEFAULT_META, TOOL_META } from './tool-meta';
import type { ConfirmActionModalProps } from './types';

export function ConfirmActionModal(props: ConfirmActionModalProps) {
  if (!props.isOpen) return null;
  return <ConfirmationReview key={props.requestId} {...props} />;
}

function ConfirmationReview({
  toolName,
  description,
  onConfirm,
  onAlways,
  onCancel,
}: ConfirmActionModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const allowAlways = Boolean(onAlways);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      // React puede retirar el nodo antes de que close restaure su invocador.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card) card.scrollTop = 0;
    // Contenido largo: mantener el inicio legible antes de recorrer las acciones.
    const initial = card && card.scrollHeight > card.clientHeight ? titleRef.current : cancelRef.current;
    initial?.focus({ preventScroll: true });
  }, [toolName, description, allowAlways]);

  const meta = TOOL_META[toolName] || DEFAULT_META;
  const { accentGradient, confirmBtnClass, confirmLabel } = getActionTone(toolName);

  return (
    <dialog ref={dialogRef} aria-modal="true" aria-labelledby={titleId}
      className="fixed inset-0 z-[200] m-0 h-dvh w-full max-h-none max-w-none border-0 bg-transparent p-0 text-inherit outline-none open:flex items-center justify-center backdrop:bg-transparent"
      onKeyDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onCancel(); }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none"
        onClick={onCancel}
      />
      <div ref={cardRef} className="relative w-[520px] max-w-[90vw] max-h-[calc(100dvh-2rem)] overscroll-contain overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
        <div className={`h-1 w-full ${accentGradient}`} />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${meta.bgColor} border flex items-center justify-center ${meta.color}`}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 ref={titleRef} id={titleId} tabIndex={-1} className="text-base font-semibold text-primary outline-none">
                SofLIA quiere {meta.label.toLowerCase()}
              </h3>
              <p className="text-sm text-secondary mt-1">
                Necesita tu permiso para continuar.
              </p>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-surface-2 border border-border rounded-xl">
            <ActionDetail toolName={toolName} description={description} />
          </div>

          {onAlways && <p className="mt-3 text-xs text-secondary">Siempre permitir recuerda este comando exacto para tu usuario y esta carpeta de trabajo.</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3 justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-primary bg-surface-2 border border-border rounded-xl transition-all active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
            >
              Cancelar
            </button>
            {onAlways && <button type="button" onClick={onAlways} className="px-5 py-2.5 text-sm font-medium text-primary bg-surface-2 border border-border rounded-xl transition-all active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none">Siempre permitir</button>}
            <button
              type="button"
              onClick={onConfirm}
              className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all active:scale-[0.98] shadow-lg motion-reduce:transition-none motion-reduce:transform-none ${confirmBtnClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
