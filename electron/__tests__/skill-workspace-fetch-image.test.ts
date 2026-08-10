import { describe, expect, it, vi } from 'vitest';
import { fetchPresentationImage } from '../skill-workspace/fetch-image';

/**
 * La URL la elige el modelo a partir de fuentes que no controlamos, y la
 * peticion sale del proceso principal: sin guardas alcanzaria la red local y
 * los servicios de metadatos de la nube. Estas pruebas fijan esa frontera.
 */

function respuestaImagen(bytes: Buffer, mime = 'image/png'): Response {
  const cuerpo = new Uint8Array(bytes);
  return new Response(cuerpo, { status: 200, headers: { 'content-type': mime } }) as unknown as Response;
}

function redireccion(destino: string): Response {
  return new Response(null, { status: 302, headers: { location: destino } }) as unknown as Response;
}

describe('descarga de imagenes para presentaciones', () => {
  it('descarga una imagen HTTPS admitida', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuestaImagen(Buffer.from('png')));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok && result.extension).toBe('.png');
    expect(result.ok && result.data.toString()).toBe('png');
  });

  it('rechaza HTTP sin cifrar', async () => {
    const fetchImpl = vi.fn();

    const result = await fetchPresentationImage('http://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    'https://localhost/foto.png',
    'https://127.0.0.1/foto.png',
    'https://10.0.0.5/foto.png',
    'https://192.168.1.10/foto.png',
    'https://172.16.4.4/foto.png',
    'https://169.254.169.254/latest/meta-data/foto.png',
    'https://[::1]/foto.png',
    'https://consola.internal/foto.png',
  ])('rechaza el destino interno %s sin llegar a pedirlo', async (url) => {
    const fetchImpl = vi.fn();

    const result = await fetchPresentationImage(url, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('revalida cada redireccion en vez de seguirla a ciegas', async () => {
    // Una URL publica que redirige al servicio de metadatos es el ataque que
    // justifica `redirect: "manual"`: sin el, fetch seguiria el salto solo.
    const fetchImpl = vi.fn().mockResolvedValueOnce(redireccion('https://169.254.169.254/token'));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sigue una redireccion a un destino publico', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redireccion('https://otro.ejemplo.com/foto.png'))
      .mockResolvedValueOnce(respuestaImagen(Buffer.from('jpeg'), 'image/jpeg'));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok && result.extension).toBe('.jpg');
  });

  it('corta la cadena de redirecciones interminables', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(redireccion('https://cdn.ejemplo.com/otra.png'));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('rechaza un recurso que no es imagen aunque la URL lo parezca', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuestaImagen(Buffer.from('<html>'), 'text/html'));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok).toBe(false);
  });

  it('rechaza una imagen que supera el limite de tamano', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuestaImagen(Buffer.alloc(5 * 1024 * 1024)));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok).toBe(false);
  });

  it('describe el fallo sin filtrar el error de red', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:443'));

    const result = await fetchPresentationImage('https://cdn.ejemplo.com/foto.png', { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).not.toContain('10.0.0.5');
  });
});
