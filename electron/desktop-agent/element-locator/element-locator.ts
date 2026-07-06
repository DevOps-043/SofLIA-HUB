import type { ElementLocatorProvider, LocateAttempt, LocateOptions, LocateResult, SpatialHint } from './types';

/**
 * Orquestador: consulta proveedores en orden (accesibilidad primero por ser
 * exacta y semantica; OCR despues por ser universal) y devuelve el primer
 * elemento encontrado junto con el resumen de intentos, para que el modelo
 * reciba diagnostico util cuando ninguna fuente encuentra el texto. La pista
 * espacial (opcional) desambigua cuando el texto aparece varias veces.
 */
export class ElementLocator {
  constructor(private readonly proveedores: ElementLocatorProvider[]) {}

  async localizarPorTexto(textoObjetivo: string, options?: LocateOptions | SpatialHint): Promise<LocateResult> {
    const locateOptions = normalizeLocateOptions(options);
    const intentos: LocateAttempt[] = [];
    for (const proveedor of this.proveedores) {
      if (!proveedor.disponible()) continue;
      try {
        const { elemento, escaneados } = await proveedor.localizar(textoObjetivo, locateOptions);
        intentos.push({ fuente: proveedor.fuente, escaneados, encontrado: elemento !== null });
        if (elemento) return { elemento, intentos };
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        intentos.push({ fuente: proveedor.fuente, escaneados: 0, encontrado: false, error: mensaje });
        console.warn(`[DesktopAgent] Localizador ${proveedor.fuente} fallo:`, mensaje);
      }
    }
    return { elemento: null, intentos };
  }
}

function normalizeLocateOptions(options?: LocateOptions | SpatialHint): LocateOptions | undefined {
  if (!options) return undefined;
  if (isLocateOptions(options)) return options;
  return { pista: options };
}

function isLocateOptions(options: LocateOptions | SpatialHint): options is LocateOptions {
  return Object.prototype.hasOwnProperty.call(options, 'pista')
    || Object.prototype.hasOwnProperty.call(options, 'bloqueados');
}

export function describeLocateAttempts(intentos: LocateAttempt[]): string {
  if (intentos.length === 0) return 'ninguna fuente disponible';
  return intentos
    .map((intento) => {
      const detalle = intento.error ? `error: ${intento.error}` : `${intento.escaneados} candidatos`;
      return `${intento.fuente === 'uia' ? 'accesibilidad' : 'lectura visual (OCR)'}: ${detalle}`;
    })
    .join('; ');
}
