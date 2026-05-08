export function UnavailablePanel() {
  return (
    <div className="h-full flex items-center justify-center p-10">
      <div className="max-w-md rounded-3xl border border-dashed border-gray-300 dark:border-white/[0.08] px-8 py-10 text-center bg-white/60 dark:bg-white/[0.02]">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Consola no disponible</h3>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
          Este panel necesita los bridges de Electron para automatizaciones, Telegram y equipos conectados.
        </p>
      </div>
    </div>
  );
}
