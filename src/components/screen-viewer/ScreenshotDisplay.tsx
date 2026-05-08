interface ScreenshotDisplayProps {
  screenshot: string | null;
  capturing: boolean;
}

export function ScreenshotDisplay({ screenshot, capturing }: ScreenshotDisplayProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
      {screenshot ? (
        <img
          src={screenshot}
          alt="Screen capture"
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-gray-200 dark:border-white/10"
        />
      ) : (
        <div className="flex flex-col items-center gap-4 text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">
            {capturing ? 'Capturando pantalla...' : 'Haz click en "Capturar" para ver tu pantalla'}
          </p>
        </div>
      )}
    </div>
  );
}
