import { useUpdatePanel } from './update-panel/useUpdatePanel';
import { ChangelogFeatures } from './update-panel/ChangelogFeatures';
import { DevUnavailable } from './update-panel/DevUnavailable';

export function UpdatePanel() {
  const update = useUpdatePanel();

  if (typeof window.updater === 'undefined') return <DevUnavailable />;

  const {
    state,
    checking,
    progress,
    error,
    currentVersion,
    availableVersion,
    notes,
    handleCheck,
    handleDownload,
    handleInstall
  } = update;

  const isChecking = checking || state === 'checking';

  // Configuración dinámica de la esfera de estado
  let sphereColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
  let glowColor = 'bg-emerald-500/20';
  let statusTitle = 'Sistema al día';
  let statusDesc = `Pulse Hub v${currentVersion} es la versión más reciente.`;
  let buttonLabel = 'Buscar actualizaciones';
  let buttonAction: () => void = () => {
    handleCheck();
  };
  let isButtonDisabled = isChecking;
  let strokeDashoffset = 440; // 0%
  let showLoader = false;
  let centerElement = null;

  if (isChecking) {
    sphereColor = 'bg-accent/10 border-accent/30 text-accent';
    glowColor = 'bg-accent/20';
    statusTitle = 'Buscando actualizaciones';
    statusDesc = 'Conectando con el servidor de Pulse...';
    buttonLabel = 'Buscando...';
    isButtonDisabled = true;
    showLoader = true;
    strokeDashoffset = 330; // 25% loader circle
  } else if (state === 'available') {
    sphereColor = 'bg-accent/10 border-accent/40 text-accent';
    glowColor = 'bg-accent/35';
    statusTitle = 'Actualización disponible';
    statusDesc = `Una nueva versión v${availableVersion} está lista para descargar.`;
    buttonLabel = 'Descargar ahora';
    buttonAction = () => { handleDownload(); };
    isButtonDisabled = false;
    centerElement = (
      <svg className="w-8 h-8 text-accent animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
      </svg>
    );
  } else if (state === 'downloading') {
    sphereColor = 'bg-accent/10 border-accent/40 text-accent';
    glowColor = 'bg-accent/30';
    statusTitle = 'Descargando';
    statusDesc = `Descargando actualización en segundo plano.`;
    buttonLabel = `Descargando (${Math.round(progress)}%)`;
    isButtonDisabled = true;
    strokeDashoffset = 440 - (440 * progress) / 100;
    centerElement = (
      <span className="text-xl font-bold font-mono tracking-tighter text-accent tabular-nums">
        {Math.round(progress)}%
      </span>
    );
  } else if (state === 'downloaded') {
    sphereColor = 'bg-success/10 border-success/40 text-success';
    glowColor = 'bg-success/35';
    statusTitle = 'Lista para instalar';
    statusDesc = 'Pulse Hub ha descargado los nuevos archivos con éxito.';
    buttonLabel = 'Reiniciar e instalar';
    buttonAction = () => { handleInstall(); };
    isButtonDisabled = false;
    strokeDashoffset = 0; // 100%
    centerElement = (
      <svg className="w-8 h-8 text-success animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  } else if (state === 'error' || error) {
    sphereColor = 'bg-danger/10 border-danger/30 text-danger';
    glowColor = 'bg-danger/25';
    statusTitle = 'Error al verificar';
    statusDesc = error || 'No se pudo establecer la conexión.';
    buttonLabel = 'Reintentar búsqueda';
    buttonAction = () => { handleCheck(); };
    isButtonDisabled = false;
    centerElement = (
      <svg className="w-7 h-7 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  } else {
    // Al día (default)
    centerElement = (
      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
    strokeDashoffset = 0; // 100% circle completed in success
  }

  return (
    <div className="h-full flex divide-x divide-border overflow-hidden select-none">
      
      {/* Columna Izquierda: Consola de Control de Estado (40% de ancho) */}
      <div className="w-[40%] flex flex-col items-center justify-between p-8 text-center shrink-0">
        
        {/* Título de la consola */}
        <div className="space-y-1 w-full text-left">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight uppercase">Consola de Estado</h3>
          <p className="text-[10px] text-secondary">Control de versiones de Pulse</p>
        </div>

        {/* Orbe Visual de Estado */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Brillo dinámico de fondo (glow) */}
          <div className={`absolute inset-2 rounded-full blur-xl opacity-30 transition-all duration-700 ${glowColor}`} />
          
          {/* Esfera / Anillo exterior */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="88"
              cy="88"
              r="78"
              className="text-border/20 stroke-current"
              strokeWidth="2.5"
              fill="transparent"
            />
            <circle
              cx="88"
              cy="88"
              r="78"
              className={`transition-all duration-500 stroke-current ${
                isChecking ? 'text-accent animate-pulse' : state === 'downloading' ? 'text-accent' : state === 'downloaded' ? 'text-success' : state === 'error' ? 'text-danger' : 'text-emerald-500'
              }`}
              strokeWidth="3.5"
              strokeDasharray={490}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          
          {/* Centro de la esfera */}
          <div className={`absolute inset-4 rounded-full border shadow-lg flex flex-col items-center justify-center bg-card ${sphereColor}`}>
            {showLoader && (
              <svg className="w-8 h-8 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {!showLoader && centerElement}
          </div>
        </div>

        {/* Información de Estado */}
        <div className="space-y-2 max-w-xs">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
            {statusTitle}
          </h4>
          <p className="text-[11px] text-secondary leading-relaxed">
            {statusDesc}
          </p>
        </div>

        {/* Botón de Acción Principal (Ultra-Minimalista / Premium) */}
        <div className="w-full space-y-4">
          <button
            onClick={buttonAction}
            disabled={isButtonDisabled}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all select-none active:scale-[0.98] border ${
              state === 'available'
                ? 'bg-accent text-on-accent border-accent/20 hover:brightness-110 shadow-lg shadow-accent/20'
                : state === 'downloaded'
                  ? 'bg-success text-white border-success/20 hover:brightness-110 shadow-lg shadow-success/20'
                  : 'bg-surface-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border-border text-gray-900 dark:text-white'
            } disabled:opacity-40 disabled:hover:bg-surface-2 disabled:active:scale-100`}
          >
            {buttonLabel}
          </button>

          <p className="text-[9px] text-secondary/60 leading-normal max-w-[200px] mx-auto">
            Las actualizaciones se verifican automáticamente en segundo plano.
          </p>
        </div>

      </div>

      {/* Columna Derecha: Línea de tiempo interactiva (60% de ancho) */}
      <div className="w-[60%] flex flex-col p-8 overflow-hidden bg-black/[0.005] dark:bg-white/[0.002]">
        <ChangelogFeatures
          releaseNotes={notes || undefined}
          newVersion={availableVersion}
        />
      </div>

    </div>
  );
}
