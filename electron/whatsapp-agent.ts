/**
 * WhatsApp Agent — Main-process Gemini agentic loop for WhatsApp messages.
 * Uses executeToolDirect() to call computer-use tools without IPC.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeToolDirect } from './computer-use-handlers';
import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { WhatsAppService } from './whatsapp-service';

// ─── Tool definitions for WhatsApp (safe subset) ──────────────────
const BLOCKED_TOOLS_WA = new Set([
  'execute_command',
  'open_application',
  'open_url',
  'take_screenshot',
]);

const CONFIRM_TOOLS_WA = new Set([
  'delete_item',
  'send_email',
]);

// ─── Memory / Lessons system ──────────────────────────────────────
const MEMORY_PATH = path.join(app.getPath('userData'), 'whatsapp-memories.json');

interface Memory {
  lesson: string;
  context: string;
  createdAt: string;
}

async function loadMemories(): Promise<Memory[]> {
  try {
    const data = await fs.readFile(MEMORY_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveMemories(memories: Memory[]): Promise<void> {
  await fs.writeFile(MEMORY_PATH, JSON.stringify(memories, null, 2), 'utf-8');
}

// ─── Tool declarations for Gemini (filtered for WhatsApp security) ─
const WA_TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'list_directory',
      description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del directorio a listar.' },
          show_hidden: { type: 'BOOLEAN' as const, description: 'Si es true, muestra archivos ocultos.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: 'Lee y devuelve el contenido de un archivo de texto. Máximo 1MB.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta completa del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo con contenido de texto.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del archivo.' },
          content: { type: 'STRING' as const, description: 'Contenido a escribir.' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'create_directory',
      description: 'Crea una carpeta nueva.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta de la carpeta.' } },
        required: ['path'],
      },
    },
    {
      name: 'move_item',
      description: 'Mueve o renombra un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta actual.' },
          destination_path: { type: 'STRING' as const, description: 'Nueva ruta.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'copy_item',
      description: 'Copia un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta origen.' },
          destination_path: { type: 'STRING' as const, description: 'Ruta destino.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'delete_item',
      description: 'Envía un archivo o carpeta a la papelera. REQUIERE confirmación del usuario via WhatsApp.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta a eliminar.' } },
        required: ['path'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Obtiene información de un archivo: tamaño, fechas, tipo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Busca archivos por nombre en un directorio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          directory: { type: 'STRING' as const, description: 'Directorio donde buscar.' },
          pattern: { type: 'STRING' as const, description: 'Patrón de texto a buscar.' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtiene información del sistema: SO, CPU, RAM, disco, y las rutas del escritorio, documentos y descargas del usuario.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_read',
      description: 'Lee el portapapeles.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_write',
      description: 'Escribe texto en el portapapeles.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { text: { type: 'STRING' as const, description: 'Texto a copiar.' } },
        required: ['text'],
      },
    },
    {
      name: 'get_email_config',
      description: 'Verifica si el email está configurado.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'configure_email',
      description: 'Configura el email (solo email + contraseña de aplicación). Solo una vez.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          email: { type: 'STRING' as const, description: 'Email del usuario.' },
          password: { type: 'STRING' as const, description: 'Contraseña de aplicación.' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'send_email',
      description: 'Envía un email. REQUIERE confirmación del usuario via WhatsApp.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          to: { type: 'STRING' as const, description: 'Destinatario.' },
          subject: { type: 'STRING' as const, description: 'Asunto.' },
          body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
          attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas de archivos adjuntos.' },
          is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'whatsapp_send_file',
      description: 'Envía un archivo de la computadora al usuario directamente por WhatsApp. Usa esto cuando el usuario pida que le envíes un archivo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a enviar.' },
          caption: { type: 'STRING' as const, description: 'Texto que acompaña al archivo.' },
        },
        required: ['file_path'],
      },
    },
    // ─── Web tools ────────────────────────────────────────────────
    {
      name: 'web_search',
      description: 'Busca información en internet. Usa esto para responder preguntas sobre temas generales, noticias, datos actuales, etc.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto de búsqueda.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'read_webpage',
      description: 'Lee y extrae el texto de una página web dada una URL.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          url: { type: 'STRING' as const, description: 'URL completa de la página web.' },
        },
        required: ['url'],
      },
    },
    // ─── Smart file search ──────────────────────────────────────
    {
      name: 'smart_find_file',
      description: 'Busca un archivo por nombre en TODA la computadora del usuario (escritorio, documentos, descargas, OneDrive, subcarpetas). Usa esto SIEMPRE que el usuario mencione un archivo por nombre. No necesitas saber la ruta — esta herramienta busca automáticamente en todas las ubicaciones comunes.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          filename: { type: 'STRING' as const, description: 'Nombre del archivo a buscar (parcial o completo). Ej: "servicios", "tarea.pdf", "notas"' },
        },
        required: ['filename'],
      },
    },
    // ─── Memory tools ─────────────────────────────────────────────
    {
      name: 'save_lesson',
      description: 'Guarda una lección aprendida para no repetir el mismo error en el futuro. Úsalo cuando el usuario te corrija o cuando descubras algo importante (como una ruta correcta, una preferencia, etc.).',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          lesson: { type: 'STRING' as const, description: 'La lección o dato a recordar. Ej: "El escritorio del usuario está en C:\\Users\\fysg5\\OneDrive\\Escritorio"' },
          context: { type: 'STRING' as const, description: 'Contexto breve de por qué se aprendió esto.' },
        },
        required: ['lesson'],
      },
    },
    {
      name: 'recall_memories',
      description: 'Consulta todas las lecciones aprendidas previamente. Úsalo al inicio de tareas para recordar preferencias y errores pasados.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
  ],
};

// ─── Build system prompt with memories ────────────────────────────
async function buildSystemPrompt(): Promise<string> {
  const memories = await loadMemories();
  const memoriesSection = memories.length > 0
    ? `\n\nLECCIONES APRENDIDAS (NO repitas estos errores):\n${memories.map((m, i) => `${i + 1}. ${m.lesson}`).join('\n')}`
    : '';

  return `Eres SOFLIA, un asistente de productividad inteligente. El usuario te está hablando desde WhatsApp y tú tienes acceso a su computadora de escritorio que está encendida.

Tus Capacidades:
- Navegar, buscar, leer, crear, mover, copiar y eliminar archivos y carpetas
- Enviar emails con archivos adjuntos
- Enviar archivos de la computadora al usuario por WhatsApp usando whatsapp_send_file
- Leer y escribir en el portapapeles
- Obtener información del sistema
- Buscar información en internet con web_search
- Leer páginas web con read_webpage
- Guardar lecciones aprendidas con save_lesson para mejorar con el tiempo

RESTRICCIONES DE SEGURIDAD:
- NO puedes ejecutar comandos en la terminal
- NO puedes abrir aplicaciones ni URLs directamente (pero puedes buscar info web)
- NO puedes tomar capturas de pantalla

REGLAS DE FORMATO (MUY IMPORTANTE):
- Estás en WhatsApp, NO en un editor de código
- NUNCA uses markdown: nada de #, ##, **, \`\`\`, -, ni bloques de código
- Usa texto plano y natural, como si hablaras por chat con un amigo
- Para enfatizar, usa *negritas de WhatsApp* (un solo asterisco)
- Para listas, usa emojis o números simples (1. 2. 3.)
- Mantén respuestas cortas y directas — máximo 3-4 líneas para respuestas simples
- Para listas de archivos, muestra solo los nombres relevantes separados por salto de línea
- NO expliques lo que vas a hacer antes de hacerlo, simplemente hazlo y responde con el resultado

REGLAS GENERALES:
1. Responde en español a menos que te pidan otro idioma
2. Para acciones destructivas (eliminar archivos, enviar emails), SIEMPRE pide confirmación primero
3. Completa las tareas ÍNTEGRAMENTE — no dejes pasos para el usuario
4. Si el usuario envía un audio, recibirás la transcripción — responde normalmente
5. Cuando el usuario te corrija algo o descubras información útil, usa save_lesson para recordarlo
6. Para preguntas de conocimiento general, noticias, o temas que no sean archivos locales, usa web_search

REGLAS CRÍTICAS SOBRE ARCHIVOS:
- Cuando el usuario mencione un archivo por nombre, usa SIEMPRE smart_find_file primero. NUNCA pidas al usuario la ruta — búscalo tú.
- smart_find_file busca en todo el sistema automáticamente (escritorio, documentos, descargas, OneDrive, subcarpetas)
- Si encuentras el archivo, usa whatsapp_send_file para enviárselo directamente sin preguntar
- NO preguntes "¿en qué carpeta está?" — simplemente búscalo con smart_find_file
- Si hay varios resultados con nombres similares, muéstralos y pregunta cuál quiere${memoriesSection}`;
}

// ─── Conversation history per number ────────────────────────────────
const MAX_HISTORY = 20;
const conversations = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>();

// ─── Pending confirmations ──────────────────────────────────────────
interface PendingConfirmation {
  toolName: string;
  args: Record<string, any>;
  resolve: (confirmed: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingConfirmations = new Map<string, PendingConfirmation>();

// ─── Model selection: prefer stable models for main process ─────────
const WA_MODEL = 'gemini-2.5-flash';

// ─── Smart file search — searches all common user locations ─────────
import os from 'node:os';
import fsSync from 'node:fs';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'AppData', '$Recycle.Bin', 'dist', 'dist-electron',
  '.cache', '.vscode', '.npm', '.nuget', 'Windows', 'Program Files',
  'Program Files (x86)', 'ProgramData', '__pycache__', '.local',
]);

async function smartFindFile(filename: string): Promise<{ success: boolean; results: Array<{ name: string; path: string; size: string }>; searchedLocations: string[]; query: string }> {
  const home = os.homedir();
  const results: Array<{ name: string; path: string; size: string }> = [];
  const searchedLocations: string[] = [];

  // Normalize search: remove accents, split into words for fuzzy matching
  const normalizeStr = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[_\-\.]/g, ' '); // treat separators as spaces

  const normalizedQuery = normalizeStr(filename);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);

  console.log(`[smart_find_file] Searching for: "${filename}" → words: [${queryWords.join(', ')}]`);

  // ─── Dynamically discover ALL OneDrive directories ─────────
  const locations: string[] = [];

  try {
    const homeEntries = fsSync.readdirSync(home, { withFileTypes: true });
    for (const entry of homeEntries) {
      if (entry.isDirectory() && entry.name.toLowerCase().startsWith('onedrive')) {
        const oneDriveRoot = path.join(home, entry.name);
        // Add OneDrive subdirectories (Escritorio, Desktop, Documents, etc.)
        try {
          const odEntries = fsSync.readdirSync(oneDriveRoot, { withFileTypes: true });
          for (const odEntry of odEntries) {
            if (odEntry.isDirectory()) {
              locations.push(path.join(oneDriveRoot, odEntry.name));
            }
          }
        } catch { /* skip */ }
        // Also add OneDrive root itself
        locations.push(oneDriveRoot);
      }
    }
  } catch { /* skip */ }

  // Standard Windows paths
  const standardPaths = [
    path.join(home, 'Desktop'),
    path.join(home, 'Escritorio'),
    path.join(home, 'Documents'),
    path.join(home, 'Documentos'),
    path.join(home, 'Downloads'),
    path.join(home, 'Descargas'),
  ];

  for (const p of standardPaths) {
    try {
      fsSync.accessSync(p);
      if (!locations.includes(p)) locations.push(p);
    } catch { /* skip */ }
  }

  // Home root last (shallow search)
  if (!locations.includes(home)) locations.push(home);

  console.log(`[smart_find_file] Searching in ${locations.length} locations: ${locations.map(l => path.basename(l)).join(', ')}`);

  // ─── Matching function: fuzzy word-based matching ─────────
  function matchesFile(entryName: string): boolean {
    const normalized = normalizeStr(entryName);
    // Exact substring match
    if (normalized.includes(normalizedQuery)) return true;
    // All query words must appear somewhere in the filename
    if (queryWords.length > 1) {
      return queryWords.every(word => normalized.includes(word));
    }
    // Single word: must be at least 3 chars and be in filename
    if (queryWords.length === 1 && queryWords[0].length >= 3) {
      return normalized.includes(queryWords[0]);
    }
    return false;
  }

  // ─── Recursive search ─────────────────────────────────────
  const MAX_RESULTS = 20;
  const MAX_DEPTH = 7;
  const visited = new Set<string>();

  async function walk(dir: string, depth: number) {
    if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;
    // Avoid visiting same directory twice (OneDrive symlinks)
    const realDir = fsSync.existsSync(dir) ? fsSync.realpathSync(dir) : dir;
    if (visited.has(realDir)) return;
    visited.add(realDir);

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= MAX_RESULTS) break;
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (matchesFile(entry.name)) {
          let size = '';
          try {
            const stat = await fs.stat(fullPath);
            const bytes = stat.size;
            if (bytes < 1024) size = `${bytes} B`;
            else if (bytes < 1024 * 1024) size = `${(bytes / 1024).toFixed(1)} KB`;
            else size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
          } catch { /* skip */ }
          results.push({ name: entry.name, path: fullPath, size });
          console.log(`[smart_find_file] Found: ${entry.name} → ${fullPath}`);
        }

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }

  for (const loc of locations) {
    if (results.length >= MAX_RESULTS) break;
    searchedLocations.push(loc);
    await walk(loc, 0);
  }

  console.log(`[smart_find_file] Total results: ${results.length}`);
  return { success: true, results, searchedLocations, query: filename };
}

// ─── Web tools implementation ───────────────────────────────────────
async function webSearch(query: string): Promise<{ success: boolean; results?: string; error?: string }> {
  try {
    // Use Google Custom Search via Gemini's grounding — fallback to direct fetch
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=es`;
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
    });
    const html = await resp.text();
    // Extract text snippets from search results
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Take a reasonable chunk
    const snippet = text.slice(0, 4000);
    return { success: true, results: snippet };
  } catch (err: any) {
    return { success: false, error: `Error buscando en la web: ${err.message}` };
  }
}

async function readWebpage(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await resp.text();
    // Strip HTML tags, scripts, styles → plain text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    // Limit to 5000 chars to avoid huge responses
    return { success: true, content: text.slice(0, 5000) };
  } catch (err: any) {
    return { success: false, error: `Error leyendo la página: ${err.message}` };
  }
}

// ─── Post-process: strip markdown formatting for WhatsApp ───────────
function formatForWhatsApp(text: string): string {
  let result = text;
  // Remove markdown headers (## Title → *Title*)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  // Remove code blocks (```lang ... ```)
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').trim();
  });
  // Remove inline code backticks
  result = result.replace(/`([^`]+)`/g, '$1');
  // Convert markdown bold **text** to WhatsApp bold *text*
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  // Remove markdown links [text](url) → text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove markdown bullet dashes at start of line → use simple format
  result = result.replace(/^\s*[-•]\s+/gm, '• ');
  // Collapse 3+ newlines into 2
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

export class WhatsAppAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private waService: WhatsAppService;
  private apiKey: string;

  constructor(waService: WhatsAppService, apiKey: string) {
    this.waService = waService;
    this.apiKey = apiKey;
  }

  updateApiKey(key: string) {
    this.apiKey = key;
    this.genAI = null;
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  // ─── Handle text messages ───────────────────────────────────────
  async handleMessage(jid: string, senderNumber: string, text: string): Promise<void> {
    // Check for pending confirmation response
    const pending = pendingConfirmations.get(senderNumber);
    if (pending) {
      const lower = text.toLowerCase().trim();
      const confirmed = lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'confirmar' || lower === 'confirmo';
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(senderNumber);
      pending.resolve(confirmed);
      return;
    }

    try {
      const response = await this.runAgentLoop(jid, senderNumber, text);
      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Error:', err);
      await this.waService.sendText(jid, `Lo siento, ocurrió un error procesando tu mensaje. Intenta de nuevo.`);
    }
  }

  // ─── Handle audio messages ──────────────────────────────────────
  async handleAudio(jid: string, senderNumber: string, audioBuffer: Buffer): Promise<void> {
    try {
      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription || !transcription.trim()) {
        await this.waService.sendText(jid, 'No pude entender el audio. ¿Podrías repetirlo o escribirlo?');
        return;
      }

      console.log(`[WhatsApp Agent] Audio transcribed: "${transcription}"`);
      await this.handleMessage(jid, senderNumber, transcription);
    } catch (err: any) {
      console.error('[WhatsApp Agent] Audio error:', err);
      await this.waService.sendText(jid, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
    }
  }

  // ─── Transcribe audio with Gemini ───────────────────────────────
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: WA_MODEL });

    const base64Audio = audioBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/ogg',
          data: base64Audio,
        },
      },
      'Transcribe este audio a texto. Solo devuelve la transcripción exacta de lo que dice la persona, sin agregar nada más. Si no puedes entenderlo, responde con una cadena vacía.',
    ]);

    return result.response.text().trim();
  }

  // ─── Agentic loop ──────────────────────────────────────────────
  private async runAgentLoop(jid: string, senderNumber: string, userMessage: string): Promise<string> {
    const ai = this.getGenAI();
    const systemPrompt = await buildSystemPrompt();
    const model = ai.getGenerativeModel({
      model: WA_MODEL,
      systemInstruction: systemPrompt,
      tools: [WA_TOOL_DECLARATIONS as any],
    });

    // Get or create conversation history (only clean user/model text pairs)
    if (!conversations.has(senderNumber)) {
      conversations.set(senderNumber, []);
    }
    const history = conversations.get(senderNumber)!;

    // Pass a COPY to startChat — the SDK mutates the array in-place
    const historyCopy = history.map(h => ({ role: h.role, parts: [...h.parts] }));

    const chatSession = model.startChat({
      history: historyCopy,
      generationConfig: { maxOutputTokens: 4096 },
    });

    let response = await chatSession.sendMessage(userMessage);
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const candidate = response.response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // Final text response
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const finalText = textParts.join('');

        // Update our clean history (only user/model text — no function roles)
        history.push({ role: 'user', parts: [{ text: userMessage }] });
        history.push({ role: 'model', parts: [{ text: finalText }] });

        // Trim history
        while (history.length > MAX_HISTORY * 2) {
          history.shift();
        }
        // Ensure starts with user
        while (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }

        return formatForWhatsApp(finalText);
      }

      // Execute function calls
      const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const toolName: string = fc.name;
        const toolArgs: Record<string, any> = fc.args || {};

        // Security: Block disallowed tools
        if (BLOCKED_TOOLS_WA.has(toolName)) {
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { success: false, error: 'Esta herramienta no está disponible por WhatsApp por seguridad.' },
            },
          });
          continue;
        }

        // Handle whatsapp_send_file specially
        if (toolName === 'whatsapp_send_file') {
          try {
            await this.waService.sendFile(jid, toolArgs.file_path, toolArgs.caption);
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, message: `Archivo enviado por WhatsApp: ${toolArgs.file_path}` },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: false, error: err.message },
              },
            });
          }
          continue;
        }

        // Handle smart_find_file
        if (toolName === 'smart_find_file') {
          const result = await smartFindFile(toolArgs.filename);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // Handle web_search
        if (toolName === 'web_search') {
          const result = await webSearch(toolArgs.query);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // Handle read_webpage
        if (toolName === 'read_webpage') {
          const result = await readWebpage(toolArgs.url);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // Handle save_lesson
        if (toolName === 'save_lesson') {
          try {
            const memories = await loadMemories();
            // Avoid duplicates
            const exists = memories.some(m => m.lesson === toolArgs.lesson);
            if (!exists) {
              memories.push({
                lesson: toolArgs.lesson,
                context: toolArgs.context || '',
                createdAt: new Date().toISOString(),
              });
              // Keep max 50 memories
              while (memories.length > 50) memories.shift();
              await saveMemories(memories);
              console.log(`[WhatsApp Agent] Memory saved: "${toolArgs.lesson}"`);
            }
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: 'Lección guardada.' } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Handle recall_memories
        if (toolName === 'recall_memories') {
          try {
            const memories = await loadMemories();
            if (memories.length === 0) {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: true, memories: [], message: 'No hay lecciones guardadas aún.' } },
              });
            } else {
              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: {
                    success: true,
                    memories: memories.map(m => m.lesson),
                    count: memories.length,
                  },
                },
              });
            }
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Confirmation for dangerous tools
        if (CONFIRM_TOOLS_WA.has(toolName)) {
          const desc = toolName === 'delete_item'
            ? `Eliminar: ${toolArgs.path}`
            : `Enviar email a: ${toolArgs.to}\nAsunto: ${toolArgs.subject}`;

          const confirmed = await this.requestConfirmation(jid, senderNumber, toolName, desc, toolArgs);

          if (!confirmed) {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: false, error: 'Acción cancelada por el usuario.' },
              },
            });
            continue;
          }
        }

        // Execute the tool via computer-use-handlers
        try {
          const result = await executeToolDirect(toolName, toolArgs);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
        } catch (err: any) {
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { success: false, error: err.message },
            },
          });
        }
      }

      // Send function responses back to model
      response = await chatSession.sendMessage(functionResponses as any);
    }

    return 'He completado las acciones solicitadas.';
  }

  private async requestConfirmation(
    jid: string,
    senderNumber: string,
    toolName: string,
    description: string,
    args: Record<string, any>
  ): Promise<boolean> {
    const emoji = toolName === 'delete_item' ? '🗑️' : '📧';
    await this.waService.sendText(
      jid,
      `${emoji} *Confirmación requerida*\n\n${description}\n\n¿Confirmas? Responde *SI* para proceder o cualquier otra cosa para cancelar.`
    );

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        pendingConfirmations.delete(senderNumber);
        resolve(false);
        this.waService.sendText(jid, 'Tiempo de confirmación agotado. Acción cancelada.');
      }, 60000); // 1 minute timeout

      pendingConfirmations.set(senderNumber, { toolName, args, resolve, timeout });
    });
  }
}
