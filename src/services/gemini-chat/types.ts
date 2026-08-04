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
  images?: string[];
  toolSystemPrompt?: string;
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
