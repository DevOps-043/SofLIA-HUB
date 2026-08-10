import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveSkillCatalog } from '../../../services/skills-service';
import { buildSkillCommands, parseSlashInput, type SkillCommand } from '../../../services/skills/slash-commands';
import type { Skill } from '../../../shared/skills/types';

/**
 * Comandos `/skill` en el compositor, tanto en el chat completo como en el
 * chat flotante del navegador.
 *
 * El catalogo se carga una vez por montaje; una Skill recien creada aparece
 * al reabrir el chat. Recargarlo en cada pulsacion consultaria la base de
 * datos mientras el usuario escribe.
 */
export function useSkillCommands(input: string, onActivate: (skill: Skill) => void) {
  const [commands, setCommands] = useState<SkillCommand[]>([]);
  // Ambos estados se anclan al termino que los produjo. Asi el resaltado y el
  // descarte caducan solos al cambiar el texto, sin un efecto que sincronice
  // estado con estado.
  const [selection, setSelection] = useState<{ term: string; index: number }>({ term: '', index: 0 });
  const [dismissedTerm, setDismissedTerm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveSkillCatalog('chat')
      .then((catalog) => {
        if (!cancelled) setCommands(buildSkillCommands(catalog));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(() => parseSlashInput(input, commands), [commands, input]);

  // El resaltado vuelve al principio cuando el termino cambia, sin efecto: el
  // valor guardado solo cuenta si pertenece al termino actual.
  const highlighted = query && selection.term === query.term ? selection.index : 0;
  const dismissed = query !== null && dismissedTerm === query.term;
  const visible = Boolean(query && !dismissed && query.matches.length > 0);

  const setHighlighted = useCallback((index: number) => {
    setSelection({ term: query?.term ?? '', index });
  }, [query?.term]);

  const activate = useCallback((entry: SkillCommand) => {
    setDismissedTerm(null);
    onActivate(entry.skill);
  }, [onActivate]);

  /**
   * Intercepta el teclado antes que el compositor. Devuelve true cuando ya
   * consumio la tecla, para que el llamador no envie el mensaje.
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!visible || !query) return false;

    if (event.key === 'Escape') {
      event.preventDefault();
      setDismissedTerm(query.term);
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const total = query.matches.length;
      setHighlighted((highlighted + direction + total) % total);
      return true;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // Con coincidencia exacta gana el comando escrito, no el resaltado:
      // quien teclea "/presentacion" completo espera esa Skill.
      const entry = query.exact ?? query.matches[highlighted] ?? query.matches[0];
      if (entry) activate(entry);
      return true;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const entry = query.matches[highlighted] ?? query.matches[0];
      if (entry) activate(entry);
      return true;
    }
    return false;
  }, [activate, highlighted, query, setHighlighted, visible]);

  return {
    visible,
    matches: query?.matches ?? [],
    highlighted,
    setHighlighted,
    handleKeyDown,
    activate,
  };
}
