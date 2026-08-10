import { useEffect, useState } from 'react';
import { windowControlsService } from '../../services/window-controls-service';

export function WindowControls({ className = '' }: { className?: string }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState<string>('win32');

  useEffect(() => {
    let mounted = true;
    windowControlsService.getPlatform().then((plat) => {
      if (mounted) setPlatform(plat);
    });
    windowControlsService.isMaximized().then((max) => {
      if (mounted) setIsMaximized(max);
    });

    const handleResize = () => {
      windowControlsService.isMaximized().then((max) => {
        if (mounted) setIsMaximized(max);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleMinimize = async () => {
    await windowControlsService.minimize();
  };

  const handleMaximize = async () => {
    await windowControlsService.maximize();
    const max = await windowControlsService.isMaximized();
    setIsMaximized(max);
  };

  const handleClose = async () => {
    await windowControlsService.close();
  };

  if (platform === 'darwin') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 [app-region:no-drag] [-webkit-app-region:no-drag] ${className}`}>
        <button
          type="button"
          aria-label="Cerrar"
          title="Cerrar"
          onClick={handleClose}
          className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e] hover:brightness-90 transition-all"
        />
        <button
          type="button"
          aria-label="Minimizar"
          title="Minimizar"
          onClick={handleMinimize}
          className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123] hover:brightness-90 transition-all"
        />
        <button
          type="button"
          aria-label="Maximizar"
          title="Maximizar"
          onClick={handleMaximize}
          className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29] hover:brightness-90 transition-all"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center h-full gap-0.5 select-none [app-region:no-drag] [-webkit-app-region:no-drag] ${className}`}>
      <button
        type="button"
        aria-label="Minimizar ventana"
        title="Minimizar"
        onClick={handleMinimize}
        className="flex h-8 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-black/10 hover:text-gray-900 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-all duration-150 active:scale-95"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
      </button>

      <button
        type="button"
        aria-label={isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'}
        title={isMaximized ? 'Restaurar' : 'Maximizar'}
        onClick={handleMaximize}
        className="flex h-8 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-black/10 hover:text-gray-900 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-all duration-150 active:scale-95"
      >
        {isMaximized ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3.5" y="1.5" width="7" height="7" rx="0.5" />
            <path d="M1.5 4.5v6h6" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1.5" y="1.5" width="9" height="9" rx="0.5" />
          </svg>
        )}
      </button>

      <button
        type="button"
        aria-label="Cerrar ventana"
        title="Cerrar"
        onClick={handleClose}
        className="flex h-8 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-red-600 hover:text-white focus-visible:outline-none dark:text-gray-400 dark:hover:bg-red-600 dark:hover:text-white transition-all duration-150 active:scale-95"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" />
        </svg>
      </button>
    </div>
  );
}
