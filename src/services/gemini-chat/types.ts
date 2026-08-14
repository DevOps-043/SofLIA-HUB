import type { MediaEnvelope, MediaRef, MediaResolutionLevel } from '../../shared/multimodal-input';

export interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, any>;
  result?: string;
}

export interface StreamSource {
  uri: string;
  title: string;
  snippet?: string;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  sources: Promise<Array<{ uri: string; title: string }> | null>;
  toolCalls?: ToolCallInfo[];
  generatedImages?: string[];
}

export interface SendMessageStreamOptions {
  model?: string;
  thinking?: { id: string; level?: string; budget?: number };
  personalization?: { nickname?: string; occupation?: string; tone?: string; instructions?: string };
  imageMetadata?: any;
  /** Data URLs de imagen. Se normalizan a `MediaRef` de tipo `inline`. */
  images?: string[];
  /** Medios del turno con su ruta de transporte ya resuelta. */
  media?: MediaRef[];
  /** Resolucion de medios pedida explicitamente; sin ella se decide por duracion. */
  mediaResolution?: MediaResolutionLevel;
  /** Sobre de lo efectivamente enviado; lo rellena el constructor de partes. */
  onMediaEnvelope?: (envelope: MediaEnvelope) => void;
  /**
   * @deprecated Sustituido por `activeSkill`. Se conserva mientras quede
   * codigo que active una herramienta de usuario por su prompt suelto.
   */
  toolSystemPrompt?: string;
  /**
   * Skill activa del turno. Aporta instrucciones al prompt y, si es del
   * sistema y tiene workspace vivo, herramientas al catalogo del turno.
   */
  activeSkill?: {
    id: string;
    name: string;
    instructions: string;
    /** Herramientas declaradas por la Skill, antes de filtrar por superficie. */
    tools: readonly string[];
    /** Workspace vivo; sin el, no se declaran herramientas de workspace. */
    workspaceId: string | null;
  };
  context?: string;
  irisContext?: string;
  sourcesContext?: string;
  /** Memoria unificada del usuario (recientes, resúmenes, hechos, skills) ya formateada. */
  memoryContext?: string;
  /** Superficie que origina el turno; decide el modelo cuando el usuario no fijo uno. */
  task?: 'chat' | 'orb';
  /** Usuario SOFIA del turno; da alcance a la cuota mensual de SofLIA Max. */
  userId?: string;
  onToolCall?: (toolCall: ToolCallInfo) => void;
  /** Señal para cancelar la generación (botón Stop del usuario). */
  signal?: AbortSignal;
}
