import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../integrated-browser/cdp-dom-snapshot';

/**
 * `DOMSnapshot.captureSnapshot` devuelve arreglos planos indexados contra una
 * tabla de cadenas compartida. Construir el fixture a mano invita a errores de
 * indice, asi que la tabla se arma con este ayudante.
 */
function newStrings() {
  const values: string[] = [];
  const index = new Map<string, number>();
  const put = (value: string): number => {
    const existing = index.get(value);
    if (existing !== undefined) return existing;
    values.push(value);
    index.set(value, values.length - 1);
    return values.length - 1;
  };
  return { values, put };
}

const RENDERED = ['block', 'visible', '1'];

/**
 * Pagina con encabezado, region principal, boton, campo de contrasena, enlace
 * con token en la query y un iframe del mismo proceso con su propio boton.
 */
function newCapture() {
  const s = newStrings();
  const style = RENDERED.map(s.put);

  // Documento raiz. El orden es el de arbol: el subarbol de un nodo es el tramo
  // contiguo que arranca justo despues de el.
  const rootNodes = {
    parentIndex: [-1, 0, 1, 2, 3, 4, 3, 6, 3, 3, 9, 2],
    nodeType: [9, 1, 1, 1, 1, 3, 1, 3, 1, 1, 3, 1],
    nodeName: [
      '#document', 'html', 'body', 'main', 'h1', '#text',
      'button', '#text', 'input', 'a', '#text', 'iframe',
    ].map(s.put),
    nodeValue: [
      '', '', '', '', '', 'Facturas del mes',
      '', 'Descargar', '', '', 'Ayuda', '',
    ].map(s.put),
    backendNodeId: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
    attributes: [
      [], [], [], [], [], [],
      [s.put('id'), s.put('descargar')],
      [],
      [s.put('type'), s.put('password')],
      [s.put('href'), s.put('https://example.com/ayuda?token=secreto')],
      [],
      [s.put('title'), s.put('Pasarela'), s.put('src'), s.put('https://pagos.example.com/widget')],
    ],
    inputChecked: { index: [] },
    contentDocumentIndex: { index: [11], value: [1] },
    currentSourceURL: { index: [] },
  };
  const rootLayout = {
    nodeIndex: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    styles: [style, style, style, style, style, style, style, style, style],
    bounds: [
      [0, 0, 800, 900],      // main
      [0, 0, 800, 40],       // h1
      [0, 0, 400, 40],       // texto del h1
      [0, 60, 120, 32],      // button
      [0, 60, 120, 32],      // texto del button
      [0, 110, 200, 28],     // input
      [0, 150, 80, 20],      // a
      [0, 150, 80, 20],      // texto del enlace
      [0, 400, 600, 300],    // iframe
    ],
    text: [-1, -1, s.put('Facturas del mes'), -1, s.put('Descargar'), -1, -1, s.put('Ayuda'), -1],
  };

  // Documento del iframe: sus coordenadas nacen relativas a si mismo.
  const frameNodes = {
    parentIndex: [-1, 0, 1, 2, 3],
    nodeType: [9, 1, 1, 1, 3],
    nodeName: ['#document', 'html', 'body', 'button', '#text'].map(s.put),
    nodeValue: ['', '', '', '', 'Pagar'].map(s.put),
    backendNodeId: [200, 201, 202, 203, 204],
    attributes: [[], [], [], [s.put('id'), s.put('pagar')], []],
    inputChecked: { index: [] },
    contentDocumentIndex: { index: [] },
    currentSourceURL: { index: [] },
  };
  const frameLayout = {
    nodeIndex: [3, 4],
    styles: [style, style],
    bounds: [[10, 20, 100, 30], [10, 20, 100, 30]],
    text: [-1, s.put('Pagar')],
  };

  return {
    documents: [
      {
        documentURL: s.put('https://example.com/facturas?sesion=abc'),
        title: s.put('Facturas'),
        contentLanguage: s.put('es'),
        nodes: rootNodes,
        layout: rootLayout,
        scrollOffsetX: 0,
        scrollOffsetY: 0,
        contentWidth: 800,
        contentHeight: 2000,
      },
      {
        documentURL: s.put('https://pagos.example.com/widget'),
        title: s.put('Pasarela'),
        contentLanguage: s.put('es'),
        nodes: frameNodes,
        layout: frameLayout,
        scrollOffsetX: 0,
        scrollOffsetY: 0,
        contentWidth: 600,
        contentHeight: 300,
      },
    ],
    strings: s.values,
  };
}

const METRICS = {
  cssLayoutViewport: { clientWidth: 800, clientHeight: 600 },
  cssVisualViewport: { pageX: 0, pageY: 0 },
  cssContentSize: { width: 800, height: 2000 },
};

describe('lectura del DOM por DOMSnapshot', () => {
  it('traduce la captura al contrato de observacion', () => {
    const snapshot = buildSnapshot(newCapture(), METRICS, 'https://example.com/facturas');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.title).toBe('Facturas');
    expect(snapshot?.language).toBe('es');
    expect(snapshot?.headings).toEqual([{ level: 1, text: 'Facturas del mes', scope: 'document' }]);
    expect(snapshot?.landmarks).toEqual([{ role: 'main', name: '', scope: 'document' }]);
    expect(snapshot?.viewport).toEqual({
      width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 2000,
    });
  });

  it('quita la query de la URL observada pero no de la imagen', () => {
    const snapshot = buildSnapshot(newCapture(), METRICS, 'https://example.com/facturas');

    // La sesion viaja en la query: el contrato de `read_browser_dom` la prohibe.
    expect(snapshot?.url).toBe('https://example.com/facturas');
    const enlace = snapshot?.controls.find((control) => control.tag === 'a');
    expect(enlace?.href).toBe('https://example.com/ayuda');
  });

  it('nunca expone el valor de una contrasena', () => {
    const snapshot = buildSnapshot(newCapture(), METRICS, 'https://example.com/facturas');
    const campo = snapshot?.controls.find((control) => control.tag === 'input');

    expect(campo?.type).toBe('password-redacted');
    expect(campo?.text).toBe('');
  });

  it('emite referencias de backendNodeId, estables ante un re-render', () => {
    const snapshot = buildSnapshot(newCapture(), METRICS, 'https://example.com/facturas');
    const boton = snapshot?.controls.find((control) => control.name === '' && control.tag === 'button');

    // `dom-N` moria con el registro de JavaScript de la pagina; el
    // `backendNodeId` lo mantiene Chromium mientras el nodo siga en el arbol.
    expect(boton?.ref).toBe('cdp-106');
    expect(boton?.text).toBe('Descargar');
  });

  it('lee el iframe del mismo proceso y traslada sus coordenadas al viewport', () => {
    const snapshot = buildSnapshot(newCapture(), METRICS, 'https://example.com/facturas');

    expect(snapshot?.frames).toEqual([
      { title: 'Pasarela', url: 'https://pagos.example.com/widget', accessible: true },
    ]);
    expect(snapshot?.text).toContain('Pagar');

    const pagar = snapshot?.controls.find((control) => control.ref === 'cdp-203');
    expect(pagar?.scope).toBe('frame:Pasarela');
    // El iframe empieza en y=400 y el boton esta a 20 dentro de el: un clic en
    // la ventana tiene que apuntar a 420, no a 20.
    expect(pagar?.rect).toEqual({ x: 10, y: 420, width: 100, height: 30 });
  });

  it('reune el texto visible de todos los documentos', () => {
    const snapshot = buildSnapshot(newCapture(), METRICS, 'https://example.com/facturas');

    expect(snapshot?.text).toBe('Facturas del mes Descargar Ayuda Pagar');
    expect(snapshot?.truncated).toBe(false);
  });

  it('omite lo que no llega a la composicion', () => {
    const capture = newCapture();
    // El boton pasa a display:none: Blink deja de darle caja y el agente no
    // debe ofrecer como accionable algo que el usuario no puede tocar.
    const oculto = capture.strings.indexOf('none') >= 0
      ? capture.strings.indexOf('none')
      : capture.strings.push('none') - 1;
    capture.documents[0].layout.styles[3] = [oculto, capture.documents[0].layout.styles[3][1], capture.documents[0].layout.styles[3][2]];

    const snapshot = buildSnapshot(capture, METRICS, 'https://example.com/facturas');

    expect(snapshot?.controls.some((control) => control.ref === 'cdp-106')).toBe(false);
    expect(snapshot?.controls.some((control) => control.ref === 'cdp-108')).toBe(true);
  });

  it('devuelve null ante una captura vacia para que el llamador use el backend en script', () => {
    expect(buildSnapshot({ documents: [], strings: [] }, METRICS, 'https://example.com')).toBeNull();
    expect(buildSnapshot({}, METRICS, 'https://example.com')).toBeNull();
  });
});
