interface ConnectedChannelCardProps {
  phoneNumber: string | null;
  onDisconnect: () => void;
}

export function ConnectedChannelCard({ phoneNumber, onDisconnect }: ConnectedChannelCardProps) {
  return (
    <div className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6 relative overflow-hidden group">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-accent animate-ping absolute inset-0" />
            <div className="w-3 h-3 rounded-full bg-accent relative z-10" />
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest leading-none">Canal Activo</h4>
            {phoneNumber && (
              <p className="text-[10px] font-mono text-accent/70 mt-1 uppercase tracking-widest">+{phoneNumber}</p>
            )}
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="px-4 py-2 text-[9px] font-black text-red-400 border border-red-400/20 bg-red-400/5 rounded-xl uppercase tracking-widest hover:bg-red-400/10 hover:border-red-400/40 transition-all"
        >
          Terminar Sesion
        </button>
      </div>
    </div>
  );
}
