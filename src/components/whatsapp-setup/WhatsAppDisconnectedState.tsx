import { Button } from '../ui/Button';
import { WhatsAppLogoIcon } from './WhatsAppLogoIcon';

interface WhatsAppDisconnectedStateProps {
  onConnect: () => void;
}

export function WhatsAppDisconnectedState({ onConnect }: WhatsAppDisconnectedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-accent/15 blur-3xl rounded-full scale-150" />
        <div className="relative w-32 h-32 rounded-[2.5rem] bg-surface-2 border border-accent/30 flex items-center justify-center shadow-xl">
          <WhatsAppLogoIcon className="w-16 h-16 text-accent" />
        </div>
      </div>
      <div className="text-center space-y-2 mb-10 max-w-xs">
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Enlace de Dispositivo</h3>
        <p className="text-sm text-secondary leading-relaxed px-4">
          Vincula tu cuenta para recibir notificaciones de AutoDev, reportes de productividad y ejecutar comandos remotos.
        </p>
      </div>
      <Button variant="primary" size="md" onClick={onConnect} icon={
        <svg className="w-4 h-4 order-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      }>
        Conectar WhatsApp
      </Button>
    </div>
  );
}
