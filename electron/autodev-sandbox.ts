import { z } from 'zod';

export interface ToolErrorResponse {
  error: string;
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
  })
};

/**
 * Middleware para validar y sanitizar el input de la herramienta,
 * previniendo inyección de comandos (CVE-2026-21256).
 */
export function validateToolInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  // Parseo inicial para asegurar tipos
  const parsed = schema.parse(input);

  // Sanitizador recursivo para caracteres peligrosos
  const sanitize = (val: any): any => {
    if (typeof val === 'string') {
      // Elimina &, |, ;, $, `
      return val.replace(/[&|;$`]/g, '');
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

  return sanitize(parsed);
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
  /**
   * Ejecuta una herramienta de forma segura, capturando excepciones para que el LLM
   * pueda corregir sus argumentos o invocación en lugar de propagar el error al Main Process.
   *
   * @param tool Función de la herramienta a ejecutar
   * @param args Argumentos que se pasarán a la herramienta
   * @returns El resultado exitoso o un objeto de error estructurado con una sugerencia de solución
   */
  static async execute<T = any>(
    tool: ToolFunction,
    ...args: any[]
  ): Promise<T | ToolErrorResponse> {
    try {
      return await tool(...args);
    }
    catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const toolName = tool.name || 'anonymous_tool';

      return {
        error: errorMessage,
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

    if (lowerError.includes('json') || lowerError.includes('zod')) {
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
  return response !== null && typeof response === 'object' && 'error' in response && 'fixSuggestion' in response;
}
