import { useEffect, useRef } from 'react';
import { workspaceApi } from '../../../services/skills/workspace-bridge';

/**
 * Ata el espacio de trabajo al chat en cuanto la conversacion existe.
 *
 * En un chat nuevo la Skill se activa ANTES de que haya conversacion: esta se
 * crea al guardar el primer mensaje. El workspace nacia entonces sin
 * conversacion y nadie lo ataba despues, de modo que al reabrir ese chat
 * `findByConversation` devolvia vacio: la presentacion seguia en disco pero no
 * habia forma de abrirla desde la interfaz.
 *
 * Solo se ata en la transicion "el chat que estoy mirando acaba de guardarse".
 * Atar cualquier pareja de identificadores seria peligroso: al abrir otro chat
 * con una presentacion suelta todavia en pantalla, se la adjudicaria a ese
 * chat. Main ademas se niega a reasignar la que ya tiene dueño.
 */
export function useSkillWorkspaceLink(input: {
  conversationId: string | null;
  workspaceId: string | null;
}): void {
  const { conversationId, workspaceId } = input;
  // Presentacion en pantalla mientras el chat aun no tenia identificador.
  const pendiente = useRef<string | null>(null);
  const atada = useRef<string | null>(null);

  useEffect(() => {
    const api = workspaceApi();
    if (!api?.attachConversation) return;

    if (!conversationId) {
      pendiente.current = workspaceId;
      return;
    }

    // Sin nada pendiente no hay nada que atar: se llego a este chat navegando,
    // no guardandolo.
    const suelta = pendiente.current;
    if (!suelta || suelta !== workspaceId || atada.current === suelta) return;
    atada.current = suelta;
    pendiente.current = null;

    void api.attachConversation(suelta, conversationId).then((resultado) => {
      // Un rechazo es informacion, no un fallo: significa que ese workspace ya
      // tiene dueño. La presentacion en pantalla sigue funcionando igual.
      if (!resultado?.success) {
        console.warn('[Skills] No se pudo atar el espacio de trabajo a la conversacion:', resultado?.error);
      }
    }).catch((error) => {
      console.warn('[Skills] No se pudo atar el espacio de trabajo a la conversacion:', error);
    });
  }, [conversationId, workspaceId]);
}
