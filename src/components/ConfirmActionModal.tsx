import React from 'react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  toolName: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const TOOL_META: Record<string, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  execute_command: {
    label: 'Ejecutar Comando',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  delete_item: {
    label: 'Eliminar Archivo',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    ),
  },
  send_email: {
    label: 'Enviar Email',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
};

const DEFAULT_META = {
  label: 'Confirmar Acción',
  color: 'text-amber-400',
  bgColor: 'bg-amber-500/10 border-amber-500/20',
  icon: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  toolName,
  description,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const meta = TOOL_META[toolName] || DEFAULT_META;
  const isDestructive = toolName === 'delete_item';
  const isEmail = toolName === 'send_email';

  const accentGradient = isDestructive
    ? 'bg-gradient-to-r from-red-500 to-red-400'
    : isEmail
    ? 'bg-gradient-to-r from-blue-500 to-blue-400'
    : 'bg-gradient-to-r from-amber-500 to-amber-400';

  const confirmBtnClass = isDestructive
    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
    : isEmail
    ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20';

  const confirmLabel = isDestructive ? 'Eliminar' : isEmail ? 'Enviar' : 'Ejecutar';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-[420px] max-w-[90vw] bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header accent bar */}
        <div className={`h-1 w-full ${accentGradient}`} />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${meta.bgColor} border flex items-center justify-center ${meta.color}`}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">
                SofLIA quiere {meta.label.toLowerCase()}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Necesita tu permiso para continuar.
              </p>
            </div>
          </div>

          {/* Action detail */}
          <div className="mt-5 p-3.5 bg-white/5 border border-white/10 rounded-xl">
            {toolName === 'execute_command' ? (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                  Comando
                </div>
                <code className="text-sm font-mono text-amber-300 break-all leading-relaxed">
                  {description.replace('Ejecutar comando: ', '')}
                </code>
              </div>
            ) : toolName === 'delete_item' ? (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                  Archivo / Carpeta
                </div>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-sm text-gray-200 break-all leading-relaxed font-mono">
                    {description.replace('Eliminar: ', '')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Se enviará a la papelera de reciclaje.
                </p>
              </div>
            ) : toolName === 'send_email' ? (
              <div className="space-y-2">
                {description.split('\n').map((line, i) => {
                  const [label, ...rest] = line.split(': ');
                  const value = rest.join(': ');
                  return (
                    <div key={i}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        {label.replace('Enviar email a', 'Destinatario')}
                      </div>
                      <span className="text-sm text-blue-300 break-all leading-relaxed">
                        {value || label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-300 break-all">{description}</p>
            )}
          </div>

          {/* Buttons */}
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
};
