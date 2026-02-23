export interface ToolErrorResponse {
  error: string;
  fixSuggestion: string;
}

export type ToolFunction = (...args: any[]) => Promise<any> | any;

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
    } catch (err: unknown) {
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

    if (lowerError.includes('json')) {
      return `Error de parseo JSON en los argumentos proporcionados a '${toolName}'. Asegúrate de enviar un JSON válido.`;
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

    return `Revisa los argumentos pasados a '${toolName}' o la lógica interna de la herramienta.`;
  }
}

/**
 * Función de utilidad para comprobar si el resultado es un error estructurado.
 */
export function isToolErrorResponse(response: any): response is ToolErrorResponse {
  return response !== null && typeof response === 'object' && 'error' in response && 'fixSuggestion' in response;
}
