import { ActionDetail } from './ActionDetail';
import { getActionTone } from './action-tone';
import { DEFAULT_META, TOOL_META } from './tool-meta';
import type { ConfirmActionModalProps } from './types';

export function ConfirmActionModal({
  isOpen,
  toolName,
  description,
  onConfirm,
  onAlways,
  onCancel,
}: ConfirmActionModalProps) {
  if (!isOpen) return null;

  const meta = TOOL_META[toolName] || DEFAULT_META;
  const { accentGradient, confirmBtnClass, confirmLabel } = getActionTone(toolName);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-action-title" className="relative w-[520px] max-w-[90vw] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className={`h-1 w-full ${accentGradient}`} />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${meta.bgColor} border flex items-center justify-center ${meta.color}`}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="confirm-action-title" className="text-base font-semibold text-primary">
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
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-primary bg-surface-2 border border-border rounded-xl transition-all active:scale-[0.98]"
            >
              Cancelar
            </button>
            {onAlways && <button onClick={onAlways} className="px-5 py-2.5 text-sm font-medium text-primary bg-surface-2 border border-border rounded-xl transition-all active:scale-[0.98]">Siempre permitir</button>}
            <button
              onClick={onConfirm}
              className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all active:scale-[0.98] shadow-lg ${confirmBtnClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
