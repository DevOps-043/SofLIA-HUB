import { z } from 'zod';
import { shell } from 'electron';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { analyzeSuspiciousUrl } from './safe-browser-tool';

const execAsync = promisify(exec);

export interface ToolErrorResponse {
  error: boolean | string;
  message?: string;
  fixSuggestion: string;
}

export type ToolFunction = (...args: any[]) => Promise<any> | any;

// Esquemas Zod para los inputs de cada herramienta
export const ToolSchemas = {
  command: z.object({
    command: z.string(),
    args: z.array(z.string()).optional()
  }),
  npmInstall: z.object({
    packageName: z.string(),
    devDependency: z.boolean().optional()
  }),
  fileOperation: z.object({
    path: z.string(),
    content: z.string().optional()
  }),
  open_file_on_computer: z.object({
    path: z.string()
  }),
  open_application: z.object({
    path: z.string()
  }),
  analyze_suspicious_link: z.object({
    url: z.string().url("Debe ser una URL válida")
  })
};

// Declaración de herramientas del sandbox (formato OpenAI/Gemini)
export const AUTODEV_SANDBOX_TOOLS = [
  {
    name: 'analyze_suspicious_link',
    description: 'Abre un navegador seguro (aislado) para analizar una URL sospechosa, retornando metadatos de seguridad y adjuntando una captura visual.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'URL completa a analizar de forma segura'
        }
      },
      required: ['url']
    }
  }
];

/**
 * Analiza un enlace sospechoso en un entorno aislado usando Safe Browser Tool.
 */
export async function analyze_suspicious_link(input: { url: string }) {
  const result = await analyzeSuspiciousUrl(input.url);
  return `[Captura Visual Adjunta]\nMetadatos de seguridad analizados:\n${JSON.stringify(result, null, 2)}`;
}

/**
 * Abre un archivo en el equipo del usuario usando la aplicación predeterminada.
 */
export async function open_file_on_computer(input: { path: string }) {
  const errorMsg = await shell.openPath(input.path);
  if (errorMsg) {
    const lower = errorMsg.toLowerCase();
    if (lower.includes('canceled') || lower.includes('cancelled') || lower.includes('eacces')) {
      return { success: false, error: "Acción cancelada por el usuario o permisos insuficientes" };
    }
    throw new Error(`Error al abrir archivo: ${errorMsg}`);
  }
  return { success: true, message: `Archivo abierto exitosamente: ${input.path}` };
}

/**
 * Abre una aplicación en el equipo del usuario.
 */
export async function open_application(input: { path: string }) {
  const errorMsg = await shell.openPath(input.path);
  if (errorMsg) {
    // Fallback a exec si shell.openPath falla
    try {
      await execAsync(`"${input.path}"`);
    } catch (execErr: any) {
      const lower = execErr.message?.toLowerCase() || '';
      if (lower.includes('canceled') || lower.includes('cancelled') || lower.includes('eacces')) {
        return { success: false, error: "Acción cancelada por el usuario o permisos insuficientes" };
      }
      throw new Error(`shell.openPath error: ${errorMsg} | exec error: ${execErr.message}`);
    }
  }
  return { success: true, message: `Aplicación iniciada exitosamente: ${input.path}` };
}

/**
 * Middleware para validar y sanitizar el input de la herramienta,
 * previniendo inyección de comandos (CVE-2026-21256).
 * 
 * Se utiliza 'any' en el parámetro schema para erradicar errores TS2345 y
 * el parámetro genérico <T> para asegurar tipado hacia el exterior.
 */
export function validateToolInput<T>(input: any, schema: any): T {
  let parsed: any;

  try {
    // 1. Zod schema con safeParse (previene excepciones crudas)
    if (schema && typeof schema.safeParse === 'function') {
      const result = schema.safeParse(input);
      if (!result.success) {
        // Validación estructural fallida - formateo amigable para LLM
        const issues = result.error.issues
          .map((issue: any) => `'${issue.path.join('.')}': ${issue.message}`)
          .join('; ');
        throw new Error(`ZodSchema Validation Failed: ${issues}`);
      }
      parsed = result.data;
    } 
    // 2. Esquema con método parse regular (versiones antiguas u otras librerías)
    else if (schema && typeof schema.parse === 'function') {
      parsed = schema.parse(input);
    } 
    // 3. Fallback: Sin esquema estructurado (passthrough)
    else {
      parsed = input;
    }
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const issues = err.issues?.map((i: any) => `'${i.path.join('.')}': ${i.message}`).join('; ') || err.message;
      throw new Error(`ZodSchema Validation Failed: ${issues}`);
    }
    // Propaga el error envuelto para mejor legibilidad por el LLM
    throw new Error(`Argument Validation Error: ${err.message || String(err)}`);
  }

  // Sanitizador recursivo para caracteres peligrosos
  const sanitize = (val: any): any => {
    if (typeof val === 'string') {
      // Elimina &, |, ;, $, `
      return val.replace(/[&|;\\$`]/g, '');
    }
    if (Array.isArray(val)) {
      return val.map(sanitize);
    }
    if (val !== null && typeof val === 'object') {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(val)) {
        sanitizedObj[key] = sanitize(value);
      }
      return sanitizedObj;
    }
    return val;
  };

  return sanitize(parsed) as T;
}

/**
 * Verifica si un paquete existe en el registro de NPM para evitar alucinaciones.
 * Si retorna 404, aborta la instalación y notifica a la IA.
 */
export async function verifyNpmPackage(pkgName: string): Promise<boolean> {
  // Separar nombre del paquete y versión (ej. my-pkg@^1.2.3 -> my-pkg, ^1.2.3)
  const cleanPkgName = pkgName.startsWith('@')
    ? '@' + pkgName.slice(1).split('@')[0]
    : pkgName.split('@')[0];

  const versionSpec = pkgName.startsWith('@')
    ? pkgName.slice(1).split('@')[1] || ''
    : pkgName.split('@')[1] || '';

  const response = await fetch(`https://registry.npmjs.org/${cleanPkgName}`);

  if (response.status === 404) {
    throw new Error(`El paquete '${pkgName}' no existe en NPM (404). Posible alucinación. Instalación abortada.`);
  }

  if (!response.ok) {
    throw new Error(`Error al verificar paquete '${pkgName}' en NPM: ${response.statusText}`);
  }

  // If a specific version was requested, verify it exists
  if (versionSpec) {
    const data = await response.json();
    const versions = Object.keys(data.versions || {});
    const distTags = data['dist-tags'] || {};

    // Strip semver range operators to get the base version
    const cleanVersion = versionSpec.replace(/^[\^~>=<]+/, '');

    // Check if the exact version exists or if any version matches the range prefix
    const versionExists = versions.some((v: string) => v === cleanVersion || v.startsWith(cleanVersion));
    const isDistTag = Object.keys(distTags).includes(versionSpec);

    if (!versionExists && !isDistTag) {
      // Suggest the latest available version
      const latest = distTags.latest || versions[versions.length - 1] || 'unknown';
      throw new Error(
        `La versión '${versionSpec}' del paquete '${cleanPkgName}' no existe en NPM. ` +
        `La última versión disponible es '${latest}'. Usa esa versión en su lugar.`
      );
    }
  }

  return true;
}

export class ToolSandbox {
  // Sobrecarga para nueva firma que incluye mapa de herramientas, nombre, e input para validación
  static async execute<T = any>(
    toolName: string,
    toolsMap: Record<string, ToolFunction>,
    input: unknown,
    customSchema?: any
  ): Promise<T | ToolErrorResponse>;

  // Sobrecarga para firma antigua (sin validación)
  static async execute<T = any>(
    tool: ToolFunction,
    ...args: any[]
  ): Promise<T | ToolErrorResponse>;

  /**
   * Ejecuta una herramienta de forma segura, capturando excepciones para que el LLM
   * pueda corregir sus argumentos o invocación en lugar de propagar el error al Main Process.
   */
  static async execute<T = any>(
    toolOrName: string | ToolFunction,
    ...args: any[]
  ): Promise<T | ToolErrorResponse> {
    let toolName = 'anonymous_tool';

    try {
      if (typeof toolOrName === 'string') {
        toolName = toolOrName;
        const toolsMap = args[0] as Record<string, ToolFunction>;
        const input = args[1];
        const customSchema = args[2];

        // Herramientas builtin del Sandbox
        const builtinTools: Record<string, ToolFunction> = {
          open_file_on_computer,
          open_application,
          analyze_suspicious_link
        };

        const tool = toolsMap?.[toolName] || builtinTools[toolName];
        if (!tool || typeof tool !== 'function') {
          throw new Error(`Herramienta desconocida: ${toolName}`);
        }

        const schema = customSchema || (ToolSchemas as Record<string, any>)[toolName];
        let validatedInput = input;

        if (schema) {
          // Explicitar el parámetro genérico para evitar TS2558 
          validatedInput = validateToolInput<any>(input, schema);
        }

        return await tool(validatedInput);
      } 
      else {
        const tool = toolOrName;
        toolName = tool.name || 'anonymous_tool';
        return await tool(...args);
      }
    }
    catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      return {
        error: true,
        message: errorMessage,
        fixSuggestion: ToolSandbox.generateFixSuggestion(errorMessage, toolName)
      };
    }
  }

  /**
   * Genera una sugerencia de corrección para el LLM basada en el mensaje de error.
   */
  private static generateFixSuggestion(errorMessage: string, toolName: string): string {
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('not a function') || lowerError.includes('undefined')) {
      return `Verifica que la herramienta '${toolName}' existe y que se están pasando los argumentos correctos.`;
    }

    if (lowerError.includes('json') || lowerError.includes('zod') || lowerError.includes('validation')) {
      return `Error de validación o parseo JSON en los argumentos proporcionados a '${toolName}'. Asegúrate de enviar un formato válido que cumpla con el esquema.`;
    }

    if (lowerError.includes('enoent') || lowerError.includes('not found')) {
      return `No se encontró el archivo o ruta. Verifica las rutas enviadas a '${toolName}'.`;
    }

    if (lowerError.includes('eacces') || lowerError.includes('permission')) {
      return `Error de permisos al ejecutar '${toolName}'. Verifica que tienes el acceso requerido.`;
    }

    if (lowerError.includes('type') || lowerError.includes('expected')) {
      return `Posible error de tipos. Revisa que los argumentos de '${toolName}' cumplan con la firma esperada.`;
    }

    if (lowerError.includes('alucinación') || lowerError.includes('npm')) {
      return `El paquete solicitado no es válido o no existe en el registro de NPM. Verifica el nombre del paquete e inténtalo nuevamente.`;
    }

    return `Revisa los argumentos pasados a '${toolName}' o la lógica interna de la herramienta.`;
  }
}

/**
 * Función de utilidad para comprobar si el resultado es un error estructurado.
 */
export function isToolErrorResponse(response: any): response is ToolErrorResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    ('error' in response) &&
    ('fixSuggestion' in response)
  );
}
