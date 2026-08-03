export function ChatUnavailableState() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
        <h2 className="text-xl font-semibold text-white">La base de datos de conversaciones no esta lista</h2>
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Pulse solo habilita el chat cuando puede usar la identidad compartida de Lia. Cierra sesion e inicia nuevamente para restaurar la sincronizacion entre tu laptop y tu PC.
        </p>
      </div>
    </div>
  );
}
