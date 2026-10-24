import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrbAnnouncements } from '../main/orb-announcements';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';

interface VentanaFalsa {
  isDestroyed: () => boolean;
  webContents: { send: ReturnType<typeof vi.fn> };
}

function crearVentana(): VentanaFalsa {
  return { isDestroyed: () => false, webContents: { send: vi.fn() } };
}

describe('cola de anuncios proactivos de la orbe', () => {
  it('un anuncio de A esperando ventana no reaparece después de A/B/A', async () => {
    setAuthState({ authenticated: true, userId: 'A' });
    let finish!: () => void;
    const opening = new Promise<void>(resolve => { finish = resolve; }); const ventana = crearVentana();
    const anuncios = createOrbAnnouncements({ getWindow: () => ventana as unknown as import('electron').BrowserWindow, showWindow: () => opening });
    const pending = anuncios.announce('Contenido de A', { title: 'Privado' });
    setAuthState({ authenticated: true, userId: 'B' }); setAuthState({ authenticated: true, userId: 'A' });
    finish(); await pending; expect(ventana.webContents.send).not.toHaveBeenCalled(); expect(anuncios.consumePending()).toBeNull(); expect(anuncios.size()).toBe(0);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStateForTests();
  });

  it('sin sesion no muestra la orbe ni encola nada', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const showWindow = vi.fn(async () => undefined);
    const anuncios = createOrbAnnouncements({ getWindow: () => null, showWindow });

    await anuncios.announce('Noticias de IA', { title: 'Noticias' });

    expect(showWindow).not.toHaveBeenCalled();
    expect(anuncios.size()).toBe(0);
    aviso.mockRestore();
  });

  it('con sesion muestra la orbe y emite el anuncio', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const ventana = crearVentana();
    const showWindow = vi.fn(async () => undefined);
    const anuncios = createOrbAnnouncements({ getWindow: () => ventana as any, showWindow });

    await anuncios.announce('Noticias de IA', { title: 'Noticias' });

    expect(showWindow).toHaveBeenCalledTimes(1);
    expect(ventana.webContents.send).toHaveBeenCalledWith('orb:announce', expect.objectContaining({
      title: 'Noticias',
      text: 'Noticias de IA',
    }));
  });

  it('serializa dos anuncios simultaneos: el segundo espera el acuse', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const ventana = crearVentana();
    const anuncios = createOrbAnnouncements({
      getWindow: () => ventana as any,
      showWindow: vi.fn(async () => undefined),
    });

    await anuncios.announce('Primero', { title: 'A' });
    await anuncios.announce('Segundo', { title: 'B' });

    // Solo suena el primero; el segundo sigue en cola.
    expect(ventana.webContents.send).toHaveBeenCalledTimes(1);
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('orb:announce', expect.objectContaining({ text: 'Primero' }));

    const primero = ventana.webContents.send.mock.calls[0][1] as { id: string };
    await anuncios.finish(primero.id);

    expect(ventana.webContents.send).toHaveBeenCalledTimes(2);
    expect(ventana.webContents.send).toHaveBeenLastCalledWith('orb:announce', expect.objectContaining({ text: 'Segundo' }));
  });

  it('el relevo entrega el anuncio a una ventana que aun no montaba', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const anuncios = createOrbAnnouncements({
      // La ventana todavia no existe: el push se habria perdido.
      getWindow: () => null,
      showWindow: vi.fn(async () => undefined),
    });

    await anuncios.announce('Noticias', { title: 'Noticias' });

    const pendiente = anuncios.consumePending();
    expect(pendiente?.text).toBe('Noticias');
    // Se consume una sola vez.
    expect(anuncios.consumePending()).toBeNull();
  });

  it('vaciar la cola descarta los anuncios pendientes', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const ventana = crearVentana();
    const anuncios = createOrbAnnouncements({
      getWindow: () => ventana as any,
      showWindow: vi.fn(async () => undefined),
    });

    await anuncios.announce('Primero', { title: 'A' });
    await anuncios.announce('Segundo', { title: 'B' });
    anuncios.clear();

    expect(anuncios.size()).toBe(0);
    expect(anuncios.consumePending()).toBeNull();
  });

  it('un acuse de un anuncio que ya no esta en curso no adelanta la cola', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const ventana = crearVentana();
    const anuncios = createOrbAnnouncements({
      getWindow: () => ventana as any,
      showWindow: vi.fn(async () => undefined),
    });

    await anuncios.announce('Primero', { title: 'A' });
    await anuncios.announce('Segundo', { title: 'B' });
    await anuncios.finish('identificador-que-no-corresponde');

    expect(ventana.webContents.send).toHaveBeenCalledTimes(1);
  });
});
