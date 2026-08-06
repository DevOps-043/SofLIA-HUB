import {
  COMPUTER_USE_TOOLS,
  GOOGLE_WORKSPACE_TOOLS,
  INTEGRATED_BROWSER_TOOLS,
  NATIVE_AI_TOOLS,
  PROJECT_HUB_TOOLS,
} from '../gemini-tools';

/**
 * El canal visible del asistente a veces recibe andamiaje interno del modelo:
 * tokens de control del formato de conversacion y el JSON de una llamada a
 * herramienta que el proveedor no separo en su propio item. Eso no es una
 * respuesta: es el razonamiento y la mecanica de la llamada, y mostrarlo
 * ensucia el chat y expone instrucciones internas al usuario.
 *
 * El saneado es incremental porque el texto llega en fragmentos: un token o un
 * objeto JSON puede repartirse entre muchos deltas del stream.
 */

/** Longitud maxima que se retiene esperando cerrar un token de control. */
const MAX_CONTROL_TOKEN_LOOKAHEAD = 200;
/** Longitud maxima que se retiene esperando cerrar un objeto JSON sospechoso. */
const MAX_JSON_LOOKAHEAD = 8_000;
/** Longitud maxima que se retiene para leer la primera clave de un objeto. */
const MAX_FIRST_KEY_LOOKAHEAD = 80;
/** Tokens cuyo encabezado continua en la palabra suelta que los sigue. */
const HEADER_TOKENS = new Set(['channel', 'start', 'constrain']);
const HEADER_WORD_PATTERN = /^[A-Za-z0-9_.-]{0,32}/;
const MAX_HEADER_WORD = 32;

/**
 * Firmas de parametros declaradas por el catalogo. Un objeto suelto en la
 * prosa cuyas claves encajan por completo en una de estas firmas es una llamada
 * filtrada, no contenido para el usuario.
 */
const TOOL_PARAMETER_SIGNATURES: Array<Set<string>> = [
  COMPUTER_USE_TOOLS,
  PROJECT_HUB_TOOLS,
  NATIVE_AI_TOOLS,
  GOOGLE_WORKSPACE_TOOLS,
  INTEGRATED_BROWSER_TOOLS,
]
  .flatMap((group) => group.functionDeclarations)
  .map((declaration) => new Set(Object.keys(declaration.parameters?.properties ?? {})))
  .filter((signature) => signature.size > 0);

const TOOL_PARAMETER_KEYS = new Set(
  TOOL_PARAMETER_SIGNATURES.flatMap((signature) => [...signature]),
);

/**
 * Claves que el proveedor agrega alrededor de una llamada filtrada y que no
 * pertenecen a ninguna firma declarada.
 */
const CALL_ENVELOPE_KEYS = new Set(['backend', 'name', 'tool', 'tool_name', 'function', 'arguments', 'parameters']);

export interface AssistantTextSanitizer {
  /** Devuelve el texto seguro que ya puede mostrarse. */
  push(chunk: string): string;
  /** Vacia lo retenido al terminar la respuesta y reinicia el estado. */
  flush(): string;
}

export function createAssistantTextSanitizer(): AssistantTextSanitizer {
  let pending = '';
  let insideCodeFence = false;
  let awaitingHeaderWord = false;

  const consumeSafePrefix = (final: boolean): string => {
    let output = '';

    while (pending.length > 0) {
      if (awaitingHeaderWord) {
        const word = pending.match(HEADER_WORD_PATTERN)?.[0] ?? '';
        // Si la palabra ocupa todo lo retenido puede continuar en el siguiente
        // fragmento; conviene esperar antes de decidir donde termina.
        if (!final && word.length === pending.length && word.length < MAX_HEADER_WORD) return output;
        awaitingHeaderWord = false;
        pending = pending.slice(word.length);
        continue;
      }

      // Dentro de un bloque de codigo el contenido es literal: ahi un token o
      // un objeto JSON son texto que el usuario pidio ver.
      const fenceIndex = pending.indexOf('```');
      const controlIndex = insideCodeFence ? -1 : pending.indexOf('<|');
      const jsonIndex = insideCodeFence ? -1 : pending.indexOf('{');
      const next = smallestIndex(fenceIndex, controlIndex, jsonIndex);

      if (next < 0) {
        // Un fragmento puede cortar el inicio de una marca ("``", "<" o "{"):
        // se retiene ese resto salvo al cerrar la respuesta.
        const holdFrom = final ? -1 : partialMarkerStart(pending);
        if (holdFrom < 0) {
          output += pending;
          pending = '';
          return output;
        }
        output += pending.slice(0, holdFrom);
        pending = pending.slice(holdFrom);
        return output;
      }

      output += pending.slice(0, next);
      pending = pending.slice(next);

      if (pending.startsWith('```')) {
        insideCodeFence = !insideCodeFence;
        output += '```';
        pending = pending.slice(3);
        continue;
      }

      if (pending.startsWith('<|')) {
        const end = pending.indexOf('|>');
        if (end < 0) {
          if (final || pending.length > MAX_CONTROL_TOKEN_LOOKAHEAD) {
            output += pending;
            pending = '';
            return output;
          }
          return output;
        }
        // `<|channel|>commentary` o `<|start|>assistant`: la palabra que sigue
        // nombra el canal o el rol y tampoco es contenido para el usuario.
        awaitingHeaderWord = HEADER_TOKENS.has(pending.slice(2, end).trim().toLowerCase());
        pending = pending.slice(end + 2);
        continue;
      }

      const decision = readLeakedToolCall(pending, final);
      if (decision === 'incomplete') return output;
      if (decision === 'not-a-call') {
        // No es una llamada: se emite la llave y se sigue buscando despues.
        output += pending.slice(0, 1);
        pending = pending.slice(1);
        continue;
      }
      pending = pending.slice(decision.length);
    }

    return output;
  };

  return {
    push(chunk: string): string {
      if (!chunk) return '';
      pending += chunk;
      return consumeSafePrefix(false);
    },
    flush(): string {
      const rest = consumeSafePrefix(true);
      const tail = pending;
      pending = '';
      insideCodeFence = false;
      awaitingHeaderWord = false;
      return rest + tail;
    },
  };
}

/** Sanea un texto ya completo (respuestas que no llegan por stream). */
export function sanitizeAssistantText(text: string): string {
  if (!text) return text;
  const sanitizer = createAssistantTextSanitizer();
  return sanitizer.push(text) + sanitizer.flush();
}

function smallestIndex(...indexes: number[]): number {
  const found = indexes.filter((index) => index >= 0);
  return found.length === 0 ? -1 : Math.min(...found);
}

/**
 * Posicion desde la que hay que retener porque el fragmento podria estar
 * cortando el inicio de una marca ("``", "`", "<" o "{").
 */
function partialMarkerStart(text: string): number {
  if (text.endsWith('``')) return text.length - 2;
  if (text.endsWith('`') || text.endsWith('<') || text.endsWith('{')) return text.length - 1;
  return -1;
}

type LeakedCallDecision = 'incomplete' | 'not-a-call' | { length: number };

/**
 * Decide si el objeto que empieza en el inicio de `text` es una llamada a
 * herramienta filtrada. Solo lo es si cierra correctamente y todas sus claves
 * de primer nivel caben en la firma declarada de alguna herramienta.
 */
function readLeakedToolCall(text: string, final: boolean): LeakedCallDecision {
  const firstKey = readFirstKey(text);
  if (firstKey === 'incomplete') return final ? 'not-a-call' : 'incomplete';
  if (!TOOL_PARAMETER_KEYS.has(firstKey) && !CALL_ENVELOPE_KEYS.has(firstKey)) return 'not-a-call';

  const end = findObjectEnd(text);
  if (end < 0) {
    if (final || text.length > MAX_JSON_LOOKAHEAD) return 'not-a-call';
    return 'incomplete';
  }

  const candidate = text.slice(0, end);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return 'not-a-call';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'not-a-call';

  const keys = Object.keys(parsed as Record<string, unknown>);
  if (keys.length === 0) return 'not-a-call';
  const payloadKeys = keys.filter((key) => !CALL_ENVELOPE_KEYS.has(key));
  const matchesDeclaredTool = TOOL_PARAMETER_SIGNATURES.some(
    (signature) => payloadKeys.every((key) => signature.has(key)),
  );
  if (!matchesDeclaredTool) return 'not-a-call';

  return { length: end };
}

/** Lee la primera clave de un objeto JSON sin parsearlo entero. */
function readFirstKey(text: string): string | 'incomplete' {
  const match = text.slice(0, MAX_FIRST_KEY_LOOKAHEAD).match(/^\{\s*"([^"\\]{1,60})"\s*:/);
  if (match) return match[1];
  return text.length >= MAX_FIRST_KEY_LOOKAHEAD ? '' : 'incomplete';
}

/** Devuelve la longitud del objeto JSON balanceado, o -1 si aun no cierra. */
function findObjectEnd(text: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}
