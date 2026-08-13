import { Menu, type ContextMenuParams, type WebContents } from 'electron';

/**
 * Acciones que el menu contextual delega en SofLIA. El texto seleccionado viaja
 * al chat como evidencia de la peticion, no como instruccion: la pagina es
 * contenido no confiable y el prompt lo enmarca de forma explicita.
 */
export type BrowserSelectionAction = 'ask' | 'improve' | 'translate' | 'summarize';

export interface BrowserSelectionRequest {
  action: BrowserSelectionAction;
  text: string;
  url: string;
  title: string;
}

/** Recorte que evita mandar una pagina entera al chat por una seleccion amplia. */
export const MAX_SELECTION_CHARS = 8_000;
/** El lector admite mucho mas texto que el adjunto del chat. */
export const MAX_READING_SELECTION_CHARS = 50_000;

export function buildBrowserContextMenu(input: {
  contents: WebContents;
  params: ContextMenuParams;
  pageTitle: string;
  onSelectionAction: (request: BrowserSelectionRequest) => void;
  onOpenReadingMode: (selection: string) => void;
}): Menu {
  const { contents, params } = input;
  const readingSelection = params.selectionText.trim().slice(0, MAX_READING_SELECTION_CHARS);
  const selection = readingSelection.slice(0, MAX_SELECTION_CHARS);
  const hasSelection = readingSelection.length > 0;

  const withSelection = (action: BrowserSelectionAction) => () => input.onSelectionAction({
    action,
    text: selection,
    url: params.pageURL,
    title: input.pageTitle,
  });

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (hasSelection) {
    template.push(
      { label: 'Preguntar a SofLIA', click: withSelection('ask') },
      { label: 'Mejorar la redacción', click: withSelection('improve') },
      { label: 'Traducir', click: withSelection('translate') },
      { label: 'Resumir', click: withSelection('summarize') },
      { type: 'separator' },
      { label: 'Copiar', role: 'copy', accelerator: 'CmdOrCtrl+C' },
      { type: 'separator' },
      { label: 'Abrir en modo lectura', click: () => input.onOpenReadingMode(readingSelection) },
    );
  } else {
    template.push(
      { label: 'Abrir en modo lectura', click: () => input.onOpenReadingMode('') },
      { type: 'separator' },
      { label: 'Atrás', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
      { label: 'Adelante', enabled: contents.navigationHistory.canGoForward(), click: () => contents.navigationHistory.goForward() },
      { label: 'Recargar', click: () => contents.reload() },
    );
  }

  if (params.isEditable) {
    template.push(
      { type: 'separator' },
      { label: 'Cortar', role: 'cut' },
      { label: 'Pegar', role: 'paste' },
      { label: 'Seleccionar todo', role: 'selectAll' },
    );
  }

  template.push(
    { type: 'separator' },
    { label: 'Inspeccionar', click: () => contents.inspectElement(params.x, params.y) },
  );

  return Menu.buildFromTemplate(template);
}

/**
 * Texto que se precarga en el campo de escritura. Ninguna accion del menu
 * envia el turno por su cuenta: la seleccion queda adjunta sobre la barra y es
 * el usuario quien decide que pedir y cuando mandarlo. Por eso "Preguntar a
 * SofLIA" no precarga nada —solo adjunta el contexto— mientras que las
 * acciones concretas dejan la instruccion escrita y editable.
 *
 * La instruccion pide adaptar el registro al contexto visible —un correo, un
 * chat de trabajo, un documento tecnico— en vez de imponer un tono fijo.
 */
export function buildSelectionInstruction(action: BrowserSelectionAction): string {
  return SELECTION_INSTRUCTIONS[action];
}

const SELECTION_INSTRUCTIONS: Record<BrowserSelectionAction, string> = {
  ask: '',
  improve: 'Mejora la redacción de este texto. Ajusta el registro a lo que veas en la página: más formal en un correo o un documento, más directo en un chat de trabajo, más preciso si el contenido es técnico. Conserva el idioma, la intención y los datos, y devuelve solo la versión mejorada seguida de una línea con los cambios principales.',
  translate: 'Traduce este texto. Si está en español pásalo a inglés; en cualquier otro caso pásalo a español. Manten el registro que tenga la página y devuelve solo la traducción.',
  summarize: 'Resume en sus puntos esenciales este texto, en su mismo idioma y con el registro que corresponda a la página.',
};
