import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PresentationWorkspacePanel } from '../../components/presentation/PresentationWorkspacePanel';

type ProgressEvent = {
  workspaceId: string;
  operation: 'escritura' | 'edicion' | 'borrado';
  path: string;
  status: 'en_curso' | 'completado' | 'error';
  message?: string;
};

const WORKSPACE_ID = 'presentacion-abc123';

/** El puente de preload no existe en jsdom; las pruebas lo instalan aqui. */
type TestScope = Window & { skillWorkspace?: unknown; presentationView?: unknown };

let archivos: { path: string; bytes: number; updatedAt: string }[];
let listo: boolean;
let contenidos: Record<string, string>;
let progressListeners: ((event: ProgressEvent) => void)[];

const abrirCarpeta = vi.fn(async () => ({ success: true }));
const escribirArchivo = vi.fn(async () => ({ success: true }));
const previewUrl = vi.fn(async () => ({ success: true, url: `pulse-presentacion://${WORKSPACE_ID}/index.html` }));
const exportHtml = vi.fn(async () => ({ success: true, htmlPath: 'demo.html' }));
const abrirPantallaCompleta = vi.fn(async () => ({ success: true }));

function emitirProgreso(event: ProgressEvent) {
  progressListeners.forEach((listener) => listener(event));
}

beforeEach(() => {
  localStorage.clear();
  archivos = [];
  listo = false;
  contenidos = {};
  progressListeners = [];
  vi.clearAllMocks();

  (window as TestScope).skillWorkspace = {
    getState: vi.fn(async () => ({
      success: true,
      state: {
        workspace: {
          id: WORKSPACE_ID,
          skillId: 'sistema:presentaciones',
          conversationId: 'conv-1',
          title: 'Propuesta Acme',
          entryFile: 'index.html',
          createdAt: '2026-08-06T10:00:00.000Z',
          updatedAt: '2026-08-06T10:00:00.000Z',
        },
        files: archivos,
        totalBytes: archivos.reduce((sum, file) => sum + file.bytes, 0),
        ready: listo,
      },
    })),
    readFile: vi.fn(async (_id: string, path: string) => ({ success: true, content: contenidos[path] ?? '' })),
    writeFile: escribirArchivo,
    openFolder: abrirCarpeta,
    previewUrl,
    onProgress: vi.fn((callback: (event: ProgressEvent) => void) => {
      progressListeners.push(callback);
      return () => {
        progressListeners = progressListeners.filter((listener) => listener !== callback);
      };
    }),
  };

  (window as TestScope).presentationView = {
    open: abrirPantallaCompleta,
    close: vi.fn(async () => ({ success: true })),
    onClosed: vi.fn(() => () => undefined),
    exportHtml,
    prepareBranding: vi.fn(async () => ({ success: true })),
  };
});

function renderPanel(onHide = vi.fn()) {
  render(<PresentationWorkspacePanel workspaceId={WORKSPACE_ID} onHide={onHide} />);
  return { onHide };
}

describe('panel de trabajo de la presentacion', () => {
  it('lista los archivos del proyecto', async () => {
    archivos = [
      { path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' },
      { path: 'estilos/presentacion.css', bytes: 80, updatedAt: '2026-08-06T10:00:00.000Z' },
    ];

    renderPanel();

    expect(await screen.findByText('index.html')).toBeInTheDocument();
    // El arbol agrupa por carpeta: la fila muestra el nombre del archivo.
    expect(screen.getByText('presentacion.css')).toBeInTheDocument();
    expect(screen.getByText('estilos')).toBeInTheDocument();
  });

  it('muestra el contenido del archivo seleccionado', async () => {
    archivos = [
      { path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' },
      { path: 'guion.md', bytes: 40, updatedAt: '2026-08-06T10:00:00.000Z' },
    ];
    contenidos = { 'index.html': '<h1>Portada</h1>', 'guion.md': '# Guion de la propuesta' };

    renderPanel();
    fireEvent.click(await screen.findByText('guion.md'));

    expect(await screen.findByText('# Guion de la propuesta')).toBeInTheDocument();
  });

  it('senala el archivo que se esta escribiendo', async () => {
    archivos = [{ path: 'index.html', bytes: 10, updatedAt: '2026-08-06T10:00:00.000Z' }];
    renderPanel();
    await screen.findByText('index.html');

    act(() => {
      emitirProgreso({ workspaceId: WORKSPACE_ID, operation: 'escritura', path: 'index.html', status: 'en_curso' });
    });

    expect(await screen.findByLabelText('Escribiendo')).toBeInTheDocument();
    expect(screen.getByText(/Escribiendo index\.html/)).toBeInTheDocument();
  });

  it('refleja un error por archivo sin perder el resto del panel', async () => {
    archivos = [{ path: 'script.js', bytes: 10, updatedAt: '2026-08-06T10:00:00.000Z' }];
    renderPanel();
    await screen.findByText('script.js');

    act(() => {
      emitirProgreso({
        workspaceId: WORKSPACE_ID,
        operation: 'escritura',
        path: 'script.js',
        status: 'error',
        message: 'Esta skill solo puede escribir archivos .html, .css, .md.',
      });
    });

    expect(await screen.findByLabelText('Error')).toBeInTheDocument();
    expect(screen.getByText('script.js')).toBeInTheDocument();
  });

  it('ignora el progreso de otro espacio de trabajo', async () => {
    archivos = [{ path: 'index.html', bytes: 10, updatedAt: '2026-08-06T10:00:00.000Z' }];
    renderPanel();
    await screen.findByText('index.html');

    act(() => {
      emitirProgreso({ workspaceId: 'otro-workspace', operation: 'escritura', path: 'ajeno.html', status: 'en_curso' });
    });

    expect(screen.queryByLabelText('Escribiendo')).not.toBeInTheDocument();
  });

  it('no permite reproducir mientras la presentacion no esta lista', async () => {
    archivos = [{ path: 'guion.md', bytes: 10, updatedAt: '2026-08-06T10:00:00.000Z' }];
    listo = false;

    renderPanel();

    const boton = await screen.findByLabelText('La presentacion aun no esta lista');
    expect(boton).toBeDisabled();
  });

  it('reproduce la presentacion cuando ya existe el documento de entrada', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    listo = true;

    renderPanel();
    fireEvent.click(await screen.findByLabelText('Reproducir la presentacion'));

    const marco = await screen.findByTitle('Vista previa de la presentacion');
    expect(marco).toHaveAttribute('sandbox', 'allow-scripts');
  });

  it('la vista previa no concede allow-same-origin', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    listo = true;

    renderPanel();
    fireEvent.click(await screen.findByLabelText('Reproducir la presentacion'));

    const marco = await screen.findByTitle('Vista previa de la presentacion');
    expect(marco.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  it('abre la presentacion a pantalla completa', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    listo = true;

    renderPanel();
    fireEvent.click(await screen.findByLabelText('Presentar a pantalla completa'));

    await waitFor(() => expect(abrirPantallaCompleta).toHaveBeenCalledWith(WORKSPACE_ID));
  });

  it('abre la carpeta de la presentacion', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];

    renderPanel();
    fireEvent.click(await screen.findByLabelText('Abrir la carpeta de la presentacion'));

    await waitFor(() => expect(abrirCarpeta).toHaveBeenCalledWith(WORKSPACE_ID));
  });

  it('exporta a HTML autocontenido y avisa del resultado', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    listo = true;

    renderPanel();
    fireEvent.click(await screen.findByLabelText('Exportar como archivo HTML'));

    await waitFor(() => expect(exportHtml).toHaveBeenCalledWith(WORKSPACE_ID));
    expect(await screen.findByRole('status')).toHaveTextContent(/conserva las animaciones/);
  });

  it('oculta el panel sin cancelar el trabajo', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    const { onHide } = renderPanel();

    fireEvent.click(await screen.findByLabelText('Ocultar el panel'));

    expect(onHide).toHaveBeenCalledTimes(1);
  });
});

describe('panel redimensionable', () => {
  it('expone un separador con los limites de ancho', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-07T10:00:00.000Z' }];
    renderPanel();

    const separador = await screen.findByRole('separator', { name: 'Ajustar ancho del panel' });
    expect(separador).toHaveAttribute('aria-orientation', 'vertical');
    expect(Number(separador.getAttribute('aria-valuemin'))).toBeGreaterThan(0);
    expect(Number(separador.getAttribute('aria-valuemax'))).toBeGreaterThan(
      Number(separador.getAttribute('aria-valuemin')),
    );
  });

  it('el teclado ajusta el ancho y lo recuerda', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-07T10:00:00.000Z' }];
    renderPanel();

    const separador = await screen.findByRole('separator', { name: 'Ajustar ancho del panel' });
    const inicial = Number(separador.getAttribute('aria-valuenow'));

    // El panel esta a la derecha: la flecha izquierda lo ensancha.
    fireEvent.keyDown(separador, { key: 'ArrowLeft' });

    const despues = Number(separador.getAttribute('aria-valuenow'));
    expect(despues).toBeGreaterThan(inicial);
    expect(Number(localStorage.getItem('pulseHub_presentationPanelWidth'))).toBe(despues);
  });

  it('no permite reducirlo por debajo del minimo', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-07T10:00:00.000Z' }];
    renderPanel();

    const separador = await screen.findByRole('separator', { name: 'Ajustar ancho del panel' });
    for (let paso = 0; paso < 30; paso += 1) fireEvent.keyDown(separador, { key: 'ArrowRight' });

    const minimo = Number(separador.getAttribute('aria-valuemin'));
    expect(Number(separador.getAttribute('aria-valuenow'))).toBe(minimo);
  });
});

describe('apertura automatica de la vista previa', () => {
  it('muestra la presentacion al terminar de generarse', async () => {
    // Al quedar lista y sin archivos en curso, el usuario debe ver el
    // resultado sin tener que buscar el boton.
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-07T10:00:00.000Z' }];
    listo = true;

    renderPanel();

    expect(await screen.findByTitle('Vista previa de la presentacion')).toBeInTheDocument();
  });

  it('no abre la vista mientras sigue escribiendo', async () => {
    archivos = [{ path: 'guion.md', bytes: 10, updatedAt: '2026-08-07T10:00:00.000Z' }];
    listo = false;

    renderPanel();
    await screen.findByText('guion.md');

    expect(screen.queryByTitle('Vista previa de la presentacion')).not.toBeInTheDocument();
  });

  it('respeta que el usuario vuelva al codigo tras abrirse sola', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-07T10:00:00.000Z' }];
    listo = true;

    renderPanel();
    await screen.findByTitle('Vista previa de la presentacion');

    fireEvent.click(screen.getByRole('button', { name: 'Codigo' }));

    expect(screen.queryByTitle('Vista previa de la presentacion')).not.toBeInTheDocument();
    expect(screen.getByText('index.html')).toBeInTheDocument();
  });

  it('muestra una imagen como imagen y NO la lee como texto', async () => {
    // Leer un PNG en utf-8 producia cientos de miles de caracteres binarios
    // que el visor convertia en decenas de miles de nodos: la aplicacion se
    // bloqueaba al seleccionarlo o al cambiar de pestana.
    archivos = [
      { path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' },
      { path: 'assets/portada.png', bytes: 582_000, updatedAt: '2026-08-06T10:00:00.000Z' },
    ];
    contenidos['index.html'] = '<!doctype html>';
    render(<PresentationWorkspacePanel workspaceId={WORKSPACE_ID} onHide={() => undefined} />);
    await screen.findByText('portada.png');

    fireEvent.click(screen.getByText('portada.png'));

    const imagen = await screen.findByAltText('assets/portada.png');
    expect(imagen).toBeTruthy();
    // La propiedad que importa: la imagen NUNCA se pide como texto. Afirmar
    // "no se llamo a readFile" seria fragil, porque la lectura del documento
    // auto-seleccionado puede seguir en vuelo.
    const lecturas = (window as TestScope).skillWorkspace as { readFile: ReturnType<typeof vi.fn> };
    const rutasLeidas = lecturas.readFile.mock.calls.map((llamada) => llamada[1]);
    expect(rutasLeidas).not.toContain('assets/portada.png');
  });

  it('abre el documento de entrada, no la primera imagen del listado', async () => {
    archivos = [
      { path: 'assets/portada.png', bytes: 582_000, updatedAt: '2026-08-06T10:00:00.000Z' },
      { path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' },
    ];
    contenidos['index.html'] = '<!doctype html>';

    render(<PresentationWorkspacePanel workspaceId={WORKSPACE_ID} onHide={() => undefined} />);

    // Se abre el documento: el boton de edicion solo aparece en texto propio.
    expect(await screen.findByText('Editar')).toBeTruthy();
  });

  it('deja al usuario editar y guardar un archivo propio', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    contenidos['index.html'] = '<!doctype html>';
    render(<PresentationWorkspacePanel workspaceId={WORKSPACE_ID} onHide={() => undefined} />);

    fireEvent.click(await screen.findByText('Editar'));
    const editor = screen.getByLabelText('Editar index.html');
    fireEvent.change(editor, { target: { value: '<!doctype html><p>editado</p>' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => expect(escribirArchivo).toHaveBeenCalledWith(
      WORKSPACE_ID,
      'index.html',
      '<!doctype html><p>editado</p>',
    ));
  });

  it('no ofrece editar los archivos que escribe el sistema', async () => {
    archivos = [{ path: 'estilos/marca.css', bytes: 700, updatedAt: '2026-08-06T10:00:00.000Z' }];
    contenidos['estilos/marca.css'] = ':root {}';

    render(<PresentationWorkspacePanel workspaceId={WORKSPACE_ID} onHide={() => undefined} />);

    await screen.findByText('marca.css');
    // La identidad de la organizacion y el sistema de diseno no se editan a
    // mano: main los rechazaria y el boton solo serviria para ver el error.
    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('abre la carpeta tras exportar, para que el archivo sea alcanzable', async () => {
    archivos = [{ path: 'index.html', bytes: 120, updatedAt: '2026-08-06T10:00:00.000Z' }];
    listo = true;
    render(<PresentationWorkspacePanel workspaceId={WORKSPACE_ID} onHide={() => undefined} />);

    fireEvent.click(await screen.findByLabelText('Exportar como archivo HTML'));

    await waitFor(() => expect(exportHtml).toHaveBeenCalled());
    await waitFor(() => expect(abrirCarpeta).toHaveBeenCalled());
  });
});
