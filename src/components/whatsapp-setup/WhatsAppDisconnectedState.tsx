import { WhatsAppLogoIcon } from './WhatsAppLogoIcon';

interface WhatsAppDisconnectedStateProps {
  onConnect: () => void;
}

export function WhatsAppDisconnectedState({ onConnect }: WhatsAppDisconnectedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative w-32 h-32 rounded-[2.5rem] bg-gray-100 dark:bg-background-dark border-2 border-accent/30 flex items-center justify-center shadow-2xl">
          <WhatsAppLogoIcon className="w-16 h-16 text-accent drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" />
        </div>
      </div>
      <div className="text-center space-y-2 mb-10 max-w-xs">
        <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest">Enlace de Dispositivo</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight leading-relaxed px-4">
          Vincula tu cuenta para recibir notificaciones de AutoDev, reportes de productividad y ejecutar comandos remotos.
        </p>
      </div>
      <button
        onClick={onConnect}
        className="group relative px-10 py-4 rounded-2xl bg-accent text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <span className="relative z-10 flex items-center gap-2">
          Conectar WhatsApp
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </button>
    </div>
  );
}
