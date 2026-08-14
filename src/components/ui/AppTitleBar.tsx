import { WindowControls } from './WindowControls';

export function AppTitleBar() {
  return (
    <header
      aria-label="Barra de título"
      className="flex h-9 shrink-0 select-none items-center justify-between border-b border-gray-200/70 bg-white/85 px-3.5 shadow-xs backdrop-blur-xl saturate-[140%] dark:border-white/[0.08] dark:bg-[#0a0d12]/85 [app-region:drag] [-webkit-app-region:drag]"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className="flex items-center [app-region:no-drag] [-webkit-app-region:no-drag]">
        <img
          src="/assets/icono.ico"
          alt="SofLIA"
          className="h-4.5 w-4.5 rounded-md object-contain transition-transform duration-200 hover:scale-105"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
      </div>

      <div className="flex-1 h-full" />

      <WindowControls className="h-full -mr-3" />
    </header>
  );
}

