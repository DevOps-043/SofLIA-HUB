import { useCallback, useState } from 'react';

/** Un borrador por actividad durante la sesión, compartido entre sus puntos de entrada. */
export function usePracticeDrafts() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const setDraft = useCallback((id: string, content: string) => setDrafts(previous => ({ ...previous, [id]: content })), []);
  return { drafts, setDraft };
}
export type PracticeDraftStore = ReturnType<typeof usePracticeDrafts>;
