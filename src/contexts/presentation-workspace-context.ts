import { createContext, useContext } from 'react';

/**
 * Presentacion activa de la conversacion y visibilidad de su panel.
 *
 * Ocultar el panel NO cancela la generacion: solo cambia `visible`. El
 * workspace sigue vivo y el usuario puede recuperarlo desde el menu de
 * herramientas del encabezado del chat.
 */
export interface PresentationWorkspaceValue {
  workspaceId: string | null;
  /** Skill del sistema duena de ese espacio de trabajo. */
  skillId: string | null;
  visible: boolean;
  /** Verdadero cuando hay una presentacion que el menu puede reabrir. */
  hasPresentation: boolean;
  activate: (workspace: { id: string; skillId: string }) => void;
  /**
   * Recupera la presentacion de una conversacion ya existente SIN abrir el
   * panel. Abrirlo solo por cambiar de chat seria intrusivo; lo que importa es
   * que el menu pueda reabrirla, que antes no podia porque el identificador se
   * perdia al cerrar el panel o al cambiar de conversacion.
   */
  restore: (workspace: { id: string; skillId: string } | null) => void;
  hide: () => void;
  show: () => void;
}

export const PresentationWorkspaceContext = createContext<PresentationWorkspaceValue | null>(null);

export function usePresentationWorkspaceContext(): PresentationWorkspaceValue {
  const value = useContext(PresentationWorkspaceContext);
  if (!value) {
    // Fuera del proveedor (por ejemplo, en la ventana de la Orbe) el panel
    // simplemente no existe; devolver un valor inerte evita ramas nulas.
    return {
      workspaceId: null,
      skillId: null,
      visible: false,
      hasPresentation: false,
      activate: () => undefined,
      restore: () => undefined,
      hide: () => undefined,
      show: () => undefined,
    };
  }
  return value;
}
