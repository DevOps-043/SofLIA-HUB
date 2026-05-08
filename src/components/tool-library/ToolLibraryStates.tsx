export function ToolLibraryLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

export function ToolLibraryError({ error }: { error: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
      {error}
    </div>
  );
}

export function ToolLibraryEmpty() {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{'\u{1F4DD}'}</div>
      <p className="text-gray-400 text-sm">No tienes herramientas guardadas aun.</p>
      <p className="text-gray-500 text-xs mt-1">Usa "Crear Prompt" en el menu + para crear una.</p>
    </div>
  );
}
