import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSkillWorkspaceTool } from '../../services/gemini-chat/skill-workspace-tools';
import type { ActiveSkillContext } from '../../services/gemini-tools/turn-catalog';

const generateImage = vi.hoisted(() => vi.fn());
vi.mock('../../services/image-generation', () => ({ generateImage }));

/**
 * Las dos herramientas de imagen son la unica via por la que entra un binario
 * al workspace. El renderer genera (tiene el modelo de imagen) y main escribe
 * y descarga (tiene las guardas de red y de ruta): estas pruebas fijan ese
 * reparto y el manejo de los fallos parciales.
 */
describe('herramientas de imagen del workspace', () => {
  const ACTIVA = { workspaceId: 'ws-1' } as ActiveSkillContext;
  let bridge: {
    writeImage: ReturnType<typeof vi.fn>;
    downloadImage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    generateImage.mockReset();
    bridge = {
      writeImage: vi.fn().mockResolvedValue({ success: true, file: { path: 'assets/fondo.png' } }),
      downloadImage: vi.fn().mockResolvedValue({ success: true, file: { path: 'assets/foto.png' } }),
    };
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = bridge;
  });

  afterEach(() => {
    delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace;
  });

  it('genera la imagen y entrega a main solo el base64', async () => {
    generateImage.mockResolvedValue({ text: '', imageData: 'data:image/png;base64,QUJD' });

    const salida = await executeSkillWorkspaceTool(
      'workspace_generate_image',
      {
        prompt: 'abstract navy gradient background',
        art_direction: 'Technical blueprint illustration, 1.5px line art',
        file_name: 'fondo.png',
      },
      ACTIVA,
    );

    // El estilo viaja aparte del motivo: es lo que mantiene coherente la serie
    // y evita el envoltorio general, que empuja a fotorrealismo.
    expect(generateImage).toHaveBeenCalledWith(
      'abstract navy gradient background',
      { artDirection: 'Technical blueprint illustration, 1.5px line art' },
    );
    // El prefijo `data:` lo entiende el navegador, no `Buffer.from(..., 'base64')`.
    expect(bridge.writeImage).toHaveBeenCalledWith('ws-1', 'fondo.png', 'QUJD');
    expect(JSON.parse(salida).success).toBe(true);
  });

  it('sin direccion de arte no fuerza ninguna: cae al envoltorio general', async () => {
    generateImage.mockResolvedValue({ text: '', imageData: 'QUJD' });

    await executeSkillWorkspaceTool(
      'workspace_generate_image',
      { prompt: 'una textura', file_name: 'fondo.png' },
      ACTIVA,
    );

    expect(generateImage).toHaveBeenCalledWith('una textura', {});
  });

  it('acepta base64 pelado sin prefijo data:', async () => {
    generateImage.mockResolvedValue({ text: '', imageData: 'QUJD' });

    await executeSkillWorkspaceTool(
      'workspace_generate_image',
      { prompt: 'texture', file_name: 'fondo.png' },
      ACTIVA,
    );

    expect(bridge.writeImage).toHaveBeenCalledWith('ws-1', 'fondo.png', 'QUJD');
  });

  it('no escribe nada si el modelo no devolvio imagen', async () => {
    generateImage.mockResolvedValue({ text: 'La peticion fue rechazada.', imageData: null });

    const salida = await executeSkillWorkspaceTool(
      'workspace_generate_image',
      { prompt: 'algo', file_name: 'fondo.png' },
      ACTIVA,
    );

    expect(bridge.writeImage).not.toHaveBeenCalled();
    expect(JSON.parse(salida)).toMatchObject({ success: false, error: 'La peticion fue rechazada.' });
  });

  it('exige prompt y nombre antes de gastar una generacion', async () => {
    const salida = await executeSkillWorkspaceTool('workspace_generate_image', { file_name: 'fondo.png' }, ACTIVA);

    expect(generateImage).not.toHaveBeenCalled();
    expect(JSON.parse(salida).success).toBe(false);
  });

  it('delega la descarga en main sin validar la URL en el renderer', async () => {
    const salida = await executeSkillWorkspaceTool(
      'workspace_download_image',
      { url: 'https://cdn.ejemplo.com/foto.png', file_name: 'foto.png' },
      ACTIVA,
    );

    expect(bridge.downloadImage).toHaveBeenCalledWith('ws-1', 'https://cdn.ejemplo.com/foto.png', 'foto.png');
    expect(JSON.parse(salida).success).toBe(true);
  });

  it('propaga el rechazo de main sin reintentar', async () => {
    bridge.downloadImage.mockResolvedValue({ success: false, error: 'No se descargan imagenes de direcciones internas.' });

    const salida = await executeSkillWorkspaceTool(
      'workspace_download_image',
      { url: 'https://169.254.169.254/token', file_name: 'foto.png' },
      ACTIVA,
    );

    expect(bridge.downloadImage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(salida).success).toBe(false);
  });

  it('no permite imagenes sin workspace activo', async () => {
    const salida = await executeSkillWorkspaceTool(
      'workspace_generate_image',
      { prompt: 'algo', file_name: 'fondo.png' },
      null,
    );

    expect(generateImage).not.toHaveBeenCalled();
    expect(JSON.parse(salida).success).toBe(false);
  });
});
