export function SkillLibraryLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
    </div>
  );
}

export function SkillLibraryError({ error }: { error: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
      {error}
    </div>
  );
}

export function SkillLibraryEmpty() {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-secondary">No has creado ninguna skill todavia.</p>
      <p className="mt-1 text-xs text-secondary/80">Usa "Crear Skill" en el menu + para crear una.</p>
    </div>
  );
}
