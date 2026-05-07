/**
 * Tipos internos del agente WhatsApp.
 *
 * Solo los compartidos entre módulos del paquete `wa-agent`.
 * El tipo público `WhatsAppAgent` (la clase) sigue exportándose desde
 * `whatsapp-agent.ts` para no romper imports existentes.
 */

/**
 * Confirmación pendiente del usuario para una tool peligrosa. Se almacena
 * mientras esperamos respuesta vía WhatsApp ("Sí" / "No"). El timeout
 * cancela automáticamente si no hay respuesta.
 */
export interface PendingConfirmation {
  toolName: string;
  args: Record<string, any>;
  resolve: (confirmed: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Entrada del trace usado por el loop guard para detectar repeticiones.
 * `toolSignature` y `responseSignature` son hashes JSON estables que
 * permiten comparar llamadas idénticas entre iteraciones.
 */
export interface ToolLoopTraceEntry {
  iteration: number;
  toolSignature: string;
  responseSignature: string;
  toolNames: string[];
  hadFailure: boolean;
}

export interface AgentLoopOptions {
  /** Si true, omite las confirmaciones del usuario (usado en tests/automatización). */
  skipConfirmations?: boolean;
}

/**
 * Categoría de evidencia que produce una tool. Usado para decidir cómo
 * presentar resultados al usuario:
 *  - `local`: datos del FS/sistema → mostrar como texto formateado
 *  - `local_visual`: capturas de pantalla → mostrar imagen
 *  - `remote`: contenido web/internet → mostrar con cita y URL
 *  - `neutral`: tools puras (memory, knowledge) → no requieren tratamiento especial
 */
export type EvidenceMode = 'local' | 'local_visual' | 'remote' | 'neutral';
