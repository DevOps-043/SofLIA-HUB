interface SettingsFooterProps {
  saving: boolean;
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SettingsFooter({ saving, loading, onClose, onSave }: SettingsFooterProps) {
  return (
    <div className="px-8 py-5 border-t border-gray-100 dark:border-white/[0.05] bg-white/80 dark:bg-[#0c0d10]/80 backdrop-blur-xl flex items-center justify-between relative z-20">
      <div className="flex items-center gap-2">
        {saving && (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Guardando...</p>
          </>
        )}
      </div>
      <div className="flex gap-4">
        <button onClick={onClose} className="px-4 py-2 text-[9px] font-bold text-gray-600 hover:text-white uppercase tracking-widest transition-colors">
          Abortar
        </button>
        <button
          onClick={onSave}
          disabled={saving || loading}
          className="group relative px-8 py-2.5 rounded-xl bg-accent text-white text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden"
        >
          <span className="relative z-10">{saving ? 'Procesando...' : 'Aplicar Cambios'}</span>
        </button>
      </div>
    </div>
  );
}
