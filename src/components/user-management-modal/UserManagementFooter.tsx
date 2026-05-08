interface UserManagementFooterProps {
  onClose: () => void;
}

export function UserManagementFooter({ onClose }: UserManagementFooterProps) {
  return (
    <div className="px-8 py-5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/2 flex items-center justify-between relative z-20">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
        <p className="text-[9px] text-gray-500 dark:text-gray-600 font-black uppercase tracking-widest">Protocolo de Gestion Activo</p>
      </div>

      <button onClick={onClose} className="px-6 py-2 rounded-xl bg-white/5 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors border border-white/5">
        Finalizar Sesion
      </button>
    </div>
  );
}
