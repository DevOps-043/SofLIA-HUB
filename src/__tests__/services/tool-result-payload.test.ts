import { describe, expect, it } from 'vitest';
import { prepareToolResult } from '../../services/gemini-chat/tool-result-payload';

/**
 * Frontera entre lo que una herramienta devuelve y lo que entra al contexto
 * del modelo. El incidente que la motiva: `take_screenshot` devolvia el PNG
 * completo como data URL y el arbol de accesibilidad entero; ambos viajaban
 * como TEXTO y se reenviaban en cada iteracion, hasta pedir 399 008 tokens
 * contra un limite de 200 000.
 */
describe('preparacion del resultado de una herramienta', () => {
  const pngGrande = `data:image/png;base64,${'A'.repeat(400_000)}`;

  it('saca la captura del texto y la entrega como imagen', () => {
    const payload = prepareToolResult(JSON.stringify({ success: true, image: pngGrande }));

    expect(payload.images).toEqual([pngGrande]);
    expect(payload.text).not.toContain('AAAA');
    expect(payload.text.length).toBeLessThan(1_000);
  });

  it('deja constancia de que la imagen existe', () => {
    // Sin la nota el modelo cree que la herramienta no devolvio nada y la
    // vuelve a llamar, repitiendo el gasto que acabamos de evitar.
    const payload = prepareToolResult(JSON.stringify({ success: true, image: pngGrande }));

    expect(JSON.parse(payload.text).image).toContain('adjunta');
  });

  it('descarta primero el campo mas pesado y dice cuanto omitio', () => {
    const payload = prepareToolResult(JSON.stringify({
      success: true,
      captured_display: { index: 1, name: 'Monitor 1' },
      axTree: { nodes: Array.from({ length: 4_000 }, (_, i) => ({ id: i, role: 'generic', name: `nodo ${i}` })) },
    }));

    const resultado = JSON.parse(payload.text);
    expect(resultado.success).toBe(true);
    // Lo que decide el modelo se conserva; el volcado estructural no.
    expect(resultado.captured_display).toEqual({ index: 1, name: 'Monitor 1' });
    expect(String(resultado.axTree)).toContain('omitido');
    expect(payload.text.length).toBeLessThanOrEqual(24_000);
  });

  it('no toca un resultado que ya cabe', () => {
    const original = JSON.stringify({ success: true, files: ['index.html', 'estilos/presentacion.css'] });

    const payload = prepareToolResult(original);

    expect(JSON.parse(payload.text)).toEqual(JSON.parse(original));
    expect(payload.images).toEqual([]);
  });

  it('devuelve siempre JSON de objeto, tambien ante una entrada invalida', () => {
    // Quien lo consume parsea el texto para reconstruir la respuesta.
    expect(() => JSON.parse(prepareToolResult('esto no es json').text)).not.toThrow();
    expect(() => JSON.parse(prepareToolResult('"solo un texto"').text)).not.toThrow();
    expect(() => JSON.parse(prepareToolResult('').text)).not.toThrow();
  });

  it('acota cuantas imagenes adjunta', () => {
    const payload = prepareToolResult(JSON.stringify({
      a: pngGrande, b: pngGrande, c: pngGrande,
    }));

    expect(payload.images).toHaveLength(2);
  });
});
