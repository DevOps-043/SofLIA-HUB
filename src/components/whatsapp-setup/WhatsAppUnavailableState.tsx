export function WhatsAppUnavailableState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-danger/5 border border-danger/15 rounded-2xl">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center border border-danger/20">
        <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Protocolo no disponible</p>
        <p className="text-sm text-secondary mt-1">
          Requiere ejecucion bajo el entorno de escritorio Pulse
        </p>
      </div>
    </div>
  );
}
