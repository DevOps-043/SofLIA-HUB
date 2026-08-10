import { desktopCapturer, dialog, type BrowserWindow } from 'electron';

const THUMBNAIL_SIZE = { width: 0, height: 0 };
const MAX_SOURCES = 24;

export interface DisplayMediaSelection {
  video: Electron.DesktopCapturerSource;
  withSystemAudio: boolean;
}

/**
 * Selector de origen para `getDisplayMedia`. Cumple el papel del cuadro de
 * Chrome: la pagina nunca elige que se comparte, lo elige el usuario, y sin
 * seleccion no se entrega ningun flujo.
 *
 * Se usa una lista nativa en vez de una ventana propia porque compartir
 * pantalla se pide desde dentro de una llamada: abrir otra ventana con render
 * propio competiria por el foco con la vista que esta capturando.
 */
export async function pickDisplayMediaSource(input: {
  parentWindow: BrowserWindow | null;
  audioRequested: boolean;
}): Promise<DisplayMediaSelection | null> {
  const sources = (await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: THUMBNAIL_SIZE,
    fetchWindowIcons: false,
  })).slice(0, MAX_SOURCES);

  if (!sources.length) throw new Error('No hay pantallas ni ventanas disponibles para compartir.');

  const labels = sources.map((source) => describeSource(source));
  const options = {
    type: 'question' as const,
    title: 'Compartir pantalla',
    message: '¿Qué quieres compartir?',
    detail: 'La página verá lo que elijas hasta que detengas la transmisión.',
    // El primer boton es el de cancelar para que Escape y cerrar el cuadro
    // signifiquen lo mismo: no compartir.
    buttons: ['Cancelar', ...labels],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
    // La captura de audio del sistema solo existe en Windows; ofrecerla en
    // otras plataformas prometeria algo que Electron no entrega.
    ...(input.audioRequested && process.platform === 'win32'
      ? { checkboxLabel: 'Compartir también el audio del sistema', checkboxChecked: false }
      : {}),
  };

  const result = input.parentWindow && !input.parentWindow.isDestroyed()
    ? await dialog.showMessageBox(input.parentWindow, options)
    : await dialog.showMessageBox(options);

  if (result.response <= 0) return null;
  const video = sources[result.response - 1];
  if (!video) return null;
  return { video, withSystemAudio: Boolean(result.checkboxChecked) };
}

function describeSource(source: Electron.DesktopCapturerSource): string {
  const name = (source.name || 'Sin nombre').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);
  return source.id.startsWith('screen:') ? `Pantalla: ${name}` : `Ventana: ${name}`;
}
