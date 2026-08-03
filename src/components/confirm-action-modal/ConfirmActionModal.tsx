import { ActionDetail } from './ActionDetail';
import { getActionTone } from './action-tone';
import { DEFAULT_META, TOOL_META } from './tool-meta';
import type { ConfirmActionModalProps } from './types';

export function ConfirmActionModal({
  isOpen,
  toolName,
  description,
  onConfirm,
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
      <div className="relative w-[420px] max-w-[90vw] bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className={`h-1 w-full ${accentGradient}`} />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${meta.bgColor} border flex items-center justify-center ${meta.color}`}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">
                Pulse quiere {meta.label.toLowerCase()}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Necesita tu permiso para continuar.
              </p>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-white/5 border border-white/10 rounded-xl">
            <ActionDetail toolName={toolName} description={description} />
          </div>

          <div className="mt-6 flex items-center gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-[0.98]"
            >
              Cancelar
            </button>
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
