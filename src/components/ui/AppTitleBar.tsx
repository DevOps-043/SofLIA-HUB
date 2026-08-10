import { WindowControls } from './WindowControls';

export function AppTitleBar() {
  return (
    <header
      aria-label="Barra de título"
      className="flex h-9 shrink-0 select-none items-center justify-between border-b border-gray-200/70 bg-white/85 px-3.5 shadow-xs backdrop-blur-xl saturate-[140%] dark:border-white/[0.08] dark:bg-[#0a0d12]/85 [app-region:drag] [-webkit-app-region:drag]"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className="flex items-center gap-2 [app-region:no-drag] [-webkit-app-region:no-drag]">
        <div className="relative flex items-center justify-center">
          <img
            src="/assets/icono.ico"
            alt="SofLIA"
            className="h-4.5 w-4.5 rounded-md object-contain transition-transform duration-200 hover:scale-105"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-white dark:ring-[#0a0d12]" aria-hidden="true" />
        </div>
        <span className="text-[12px] font-semibold tracking-tight text-[#0A2540] dark:text-white/90">
          SofLIA
        </span>
      </div>

      <div className="flex-1 h-full" />

      <WindowControls className="h-full -mr-3" />
    </header>
  );
}

