interface WhatsAppPairingStateProps {
  connecting: boolean;
  qr: string | null;
}

export function WhatsAppPairingState({ connecting, qr }: WhatsAppPairingStateProps) {
  if (!connecting && !qr) return null;

  return (
    <div className="flex flex-col items-center py-10 animate-in fade-in zoom-in-95 duration-500">
      {qr ? (
        <div className="space-y-10 flex flex-col items-center">
          <div className="relative p-8 bg-surface-2 border border-border rounded-[3rem] shadow-sm group transition-colors duration-500 hover:border-accent/40">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent rounded-full text-[11px] font-medium text-on-accent">Scanner Ready</div>
            <div className="relative bg-white rounded-4xl p-6 shadow-2xl">
              <img src={qr} alt="QR Code" className="w-56 h-56" />
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-xl -translate-x-2 -translate-y-2" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-xl translate-x-2 -translate-y-2" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-xl -translate-x-2 translate-y-2" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-xl translate-x-2 translate-y-2" />
            </div>
          </div>
          <div className="text-center space-y-4 max-w-sm">
            <h4 className="text-gray-900 dark:text-white text-sm font-semibold">Protocolo de Emparejamiento</h4>
            <div className="space-y-2 bg-surface-2 border border-border rounded-2xl p-4">
              <p className="text-xs text-secondary font-medium flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                Instrucciones de Vinculacion
              </p>
              <ol className="text-sm text-secondary space-y-1.5">
                <li>1. Abre WhatsApp en tu dispositivo movil</li>
                <li>2. Menu &gt; Dispositivos vinculados</li>
                <li>3. Escanea esta matriz tecnica</li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-border rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-accent animate-pulse">Sincronizando Terminal...</p>
        </div>
      )}
    </div>
  );
}
