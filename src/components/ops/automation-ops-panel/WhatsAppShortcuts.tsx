const SHORTCUTS = ['/correo', '/agenda', '/seguimiento', '/prepreunion', '/driveproyecto', '/chatdirectivo', '/computadora', '/crearflujo', '/flujos', '/pendientes', '/aprobar', '/rechazar'];

export function WhatsAppShortcuts() {
  return (
    <details className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-semibold text-gray-600 dark:text-gray-400">Atajos de WhatsApp</summary>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SHORTCUTS.map((cmd) => (
          <code key={cmd} className="px-2 py-1 rounded-md bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-[10px] font-mono text-gray-600 dark:text-gray-400">{cmd}</code>
        ))}
      </div>
    </details>
  );
}
