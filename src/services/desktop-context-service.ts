// Wrapper tipado del contexto de aplicaciones de escritorio.
//
// Espeja `electron/desktop-context/types.ts`. Cuando la capacidad esta
// desactivada en main, `window.desktopContext` no existe y `isAvailable()`
// devuelve false: el chat oculta la entrada del menu y sigue funcionando igual.

export type DesktopContextLevel = 'documento' | 'accesibilidad' | 'captura';

export type DesktopContextWarning =
  | 'cambios_sin_guardar'
  | 'contenido_truncado'
  | 'solo_visible'
  | 'sin_texto';

export interface DesktopWindowCandidate {
  id: string;
  title: string;
  appName: string;
  pid: number;
  thumbnail: string;
  expectedLevel: DesktopContextLevel;
}

export interface DesktopContextInventory {
  candidates: DesktopWindowCandidate[];
  availableLevels: DesktopContextLevel[];
  platform: string;
}

export interface DesktopAppContextAttachment {
  appId: string;
  title: string;
  appName: string;
  level: DesktopContextLevel;
  source: string;
  text: string;
  image?: string;
  warnings: DesktopContextWarning[];
  charCount: number;
}

export interface DesktopContextInventoryResponse {
  success: boolean;
  inventory?: DesktopContextInventory;
  error?: string;
}

export interface DesktopContextCaptureResponse {
  success: boolean;
  attachment?: DesktopAppContextAttachment;
  error?: string;
}

interface DesktopContextApi {
  listApps(): Promise<DesktopContextInventoryResponse>;
  captureApp(appId: string): Promise<DesktopContextCaptureResponse>;
}

declare global {
  interface Window {
    desktopContext?: DesktopContextApi;
  }
}

function requireApi(): DesktopContextApi {
  if (!window.desktopContext) {
    throw new Error('El contexto de aplicaciones no esta disponible en este entorno.');
  }
  return window.desktopContext;
}

export const desktopContextService = {
  isAvailable: (): boolean => Boolean(window.desktopContext),
  listApps: (): Promise<DesktopContextInventoryResponse> => requireApi().listApps(),
  captureApp: (appId: string): Promise<DesktopContextCaptureResponse> => requireApi().captureApp(appId),
};

/** Etiqueta corta del nivel, para el chip y el selector. */
export function levelLabel(level: DesktopContextLevel): string {
  switch (level) {
    case 'documento':
      return 'Documento completo';
    case 'accesibilidad':
      return 'Texto de la ventana';
    default:
      return 'Captura de pantalla';
  }
}

/** Aviso legible; devuelve cadena vacia cuando no hay nada que advertir. */
export function warningLabel(warning: DesktopContextWarning): string {
  switch (warning) {
    case 'cambios_sin_guardar':
      return 'con cambios sin guardar';
    case 'contenido_truncado':
      return 'contenido recortado';
    case 'solo_visible':
      return 'solo lo visible';
    case 'sin_texto':
      return 'sin contenido legible';
    default:
      return '';
  }
}
