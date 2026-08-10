import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  PresentationWorkspaceContext,
  type PresentationWorkspaceValue,
} from './presentation-workspace-context';

export function PresentationWorkspaceProvider(props: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<{ id: string; skillId: string } | null>(null);
  const [visible, setVisible] = useState(false);

  const activate = useCallback((next: { id: string; skillId: string }) => {
    setWorkspace(next);
    // Abrir el panel al empezar a generar es lo que hace visible el proceso;
    // el usuario puede ocultarlo despues y el trabajo continua.
    setVisible(true);
  }, []);

  /**
   * Al cambiar de conversacion se apunta a su presentacion, o a ninguna. Sin
   * esto el identificador de la conversacion anterior seguia vivo y el menu
   * reabria una presentacion que no era la de este chat.
   */
  const restore = useCallback((next: { id: string; skillId: string } | null) => {
    setWorkspace(next);
    if (!next) setVisible(false);
  }, []);

  const value = useMemo<PresentationWorkspaceValue>(() => ({
    workspaceId: workspace?.id ?? null,
    skillId: workspace?.skillId ?? null,
    visible: visible && Boolean(workspace),
    hasPresentation: Boolean(workspace),
    activate,
    restore,
    hide: () => setVisible(false),
    show: () => setVisible(true),
  }), [activate, restore, visible, workspace]);

  return (
    <PresentationWorkspaceContext.Provider value={value}>
      {props.children}
    </PresentationWorkspaceContext.Provider>
  );
}
