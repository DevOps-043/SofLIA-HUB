import { describe, expect, it } from 'vitest';
import {
  MAX_BROWSER_MARKS,
  buildBrowserMarks,
  iou,
  scaleRectToImage,
} from '../integrated-browser/dom-element-source';
import type { BrowserDomControl } from '../integrated-browser/types';

const VIEWPORT = { width: 800, height: 600 };

function control(overrides: Partial<BrowserDomControl> & { ref: string }): BrowserDomControl {
  return {
    ref: overrides.ref,
    tag: overrides.tag ?? 'button',
    role: overrides.role ?? '',
    name: overrides.name ?? '',
    text: overrides.text ?? '',
    type: overrides.type ?? '',
    href: overrides.href ?? '',
    disabled: overrides.disabled ?? false,
    checked: overrides.checked ?? null,
    rect: overrides.rect ?? { x: 0, y: 0, width: 100, height: 30 },
    scope: overrides.scope ?? 'document',
  };
}

describe('marcas del navegador desde el DOM', () => {
  it('numera en orden de lectura, no en orden del arbol', () => {
    const marks = buildBrowserMarks({
      controls: [
        control({ ref: 'a', name: 'Abajo', rect: { x: 10, y: 300, width: 80, height: 30 } }),
        control({ ref: 'b', name: 'Arriba derecha', rect: { x: 400, y: 20, width: 80, height: 30 } }),
        control({ ref: 'c', name: 'Arriba izquierda', rect: { x: 20, y: 24, width: 80, height: 30 } }),
      ],
    }, VIEWPORT);

    // Numeros contiguos deben quedar cerca en pantalla; si no, el modelo tiene
    // que rastrear la imagen entera por cada numero. Los dos de arriba estan a
    // `y` distinta —20 y 24— y aun asi son la misma fila visual.
    expect(marks.map((mark) => mark.name)).toEqual(['Arriba izquierda', 'Arriba derecha', 'Abajo']);
    expect(marks.map((mark) => mark.id)).toEqual([1, 2, 3]);
  });

  it('agrupa en fila los controles de una barra aunque no compartan la y exacta', () => {
    const marks = buildBrowserMarks({
      controls: [
        control({ ref: 'c', name: 'Tercero', rect: { x: 300, y: 18, width: 60, height: 24 } }),
        control({ ref: 'a', name: 'Primero', rect: { x: 20, y: 22, width: 60, height: 30 } }),
        control({ ref: 'b', name: 'Segundo', rect: { x: 160, y: 10, width: 60, height: 40 } }),
        control({ ref: 'd', name: 'Fila siguiente', rect: { x: 20, y: 90, width: 60, height: 24 } }),
      ],
    }, VIEWPORT);

    expect(marks.map((mark) => mark.name)).toEqual(['Primero', 'Segundo', 'Tercero', 'Fila siguiente']);
  });

  it('conserva el ref de cada control para poder resolver el clic sin pixeles', () => {
    const marks = buildBrowserMarks({
      controls: [control({ ref: 'cdp-203', name: 'Pagar' })],
    }, VIEWPORT);

    expect(marks[0]).toMatchObject({ id: 1, ref: 'cdp-203', name: 'Pagar' });
  });

  it('descarta lo deshabilitado, lo diminuto y lo que quedo fuera del area visible', () => {
    const marks = buildBrowserMarks({
      controls: [
        control({ ref: 'ok', name: 'Visible' }),
        control({ ref: 'apagado', name: 'Deshabilitado', disabled: true }),
        control({ ref: 'pixel', name: 'Diminuto', rect: { x: 5, y: 5, width: 4, height: 4 } }),
        control({ ref: 'arriba', name: 'Sobre el borde', rect: { x: 10, y: -60, width: 80, height: 30 } }),
        control({ ref: 'abajo', name: 'Bajo el pliegue', rect: { x: 10, y: 900, width: 80, height: 30 } }),
        control({ ref: 'derecha', name: 'Fuera a la derecha', rect: { x: 900, y: 10, width: 80, height: 30 } }),
      ],
    }, VIEWPORT);

    expect(marks.map((mark) => mark.ref)).toEqual(['ok']);
  });

  it('fusiona controles superpuestos para no apilar dos numeros en el mismo pixel', () => {
    const marks = buildBrowserMarks({
      controls: [
        // Un enlace que envuelve a un boton produce dos cajas casi identicas.
        control({ ref: 'enlace', tag: 'a', name: 'Ver factura', rect: { x: 10, y: 10, width: 120, height: 40 } }),
        control({ ref: 'boton', name: 'Ver factura', rect: { x: 11, y: 11, width: 118, height: 38 } }),
        control({ ref: 'otro', name: 'Descargar', rect: { x: 200, y: 10, width: 120, height: 40 } }),
      ],
    }, VIEWPORT);

    expect(marks.map((mark) => mark.ref)).toEqual(['enlace', 'otro']);
  });

  it('respeta el tope de marcas y renumera sin huecos', () => {
    const controls = Array.from({ length: 60 }, (_, index) => control({
      ref: `dom-${index}`,
      rect: { x: 10, y: index * 30, width: 80, height: 20 },
    }));

    const marks = buildBrowserMarks({ controls }, { width: 800, height: 4_000 });

    expect(marks).toHaveLength(MAX_BROWSER_MARKS);
    expect(marks.map((mark) => mark.id)).toEqual(
      Array.from({ length: MAX_BROWSER_MARKS }, (_, index) => index + 1),
    );
  });

  it('traduce rol, etiqueta y tipo al vocabulario de color del dibujado', () => {
    const marks = buildBrowserMarks({
      controls: [
        control({ ref: '1', tag: 'a', href: 'https://example.com', rect: { x: 0, y: 0, width: 60, height: 20 } }),
        control({ ref: '2', tag: 'input', type: 'checkbox', rect: { x: 100, y: 0, width: 20, height: 20 } }),
        control({ ref: '3', tag: 'input', type: 'text', rect: { x: 200, y: 0, width: 200, height: 24 } }),
        control({ ref: '4', tag: 'div', role: 'combobox', rect: { x: 450, y: 0, width: 120, height: 24 } }),
        control({ ref: '5', tag: 'select', rect: { x: 0, y: 60, width: 120, height: 24 } }),
      ],
    }, VIEWPORT);

    expect(marks.map((mark) => mark.controlType)).toEqual([
      'Link', 'CheckBox', 'Edit', 'ComboBox', 'ComboBox',
    ]);
  });

  it('usa el texto cuando el control no tiene nombre accesible', () => {
    const marks = buildBrowserMarks({
      controls: [control({ ref: '1', name: '', text: 'Enviar formulario' })],
    }, VIEWPORT);

    expect(marks[0].name).toBe('Enviar formulario');
  });

  it('devuelve lista vacia sin controles', () => {
    expect(buildBrowserMarks({ controls: [] }, VIEWPORT)).toEqual([]);
  });
});

describe('escala de la marca a la imagen', () => {
  it('traslada del viewport a los pixeles reales de la captura reducida', () => {
    // La percepcion se reduce a 1024 px en su lado mayor: dibujar con
    // coordenadas del viewport desplazaria las marcas cada vez mas al bajar.
    const escalado = scaleRectToImage(
      { x: 400, y: 300, width: 200, height: 50 },
      { width: 1600, height: 1200 },
      { width: 1024, height: 768 },
    );

    expect(escalado).toEqual({ x: 256, y: 192, width: 128, height: 32 });
  });

  it('es identidad cuando la captura no se redujo', () => {
    const escalado = scaleRectToImage(
      { x: 10, y: 20, width: 30, height: 40 },
      { width: 800, height: 600 },
      { width: 800, height: 600 },
    );

    expect(escalado).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('rechaza un viewport degenerado en vez de dividir por cero', () => {
    expect(scaleRectToImage({ x: 0, y: 0, width: 1, height: 1 }, { width: 0, height: 600 }, { width: 10, height: 10 }))
      .toBeNull();
  });
});

describe('interseccion sobre union', () => {
  it('vale 1 en cajas identicas y 0 en disjuntas', () => {
    const caja = { x: 0, y: 0, width: 10, height: 10 };
    expect(iou(caja, { ...caja })).toBe(1);
    expect(iou(caja, { x: 50, y: 50, width: 10, height: 10 })).toBe(0);
  });

  it('vale 1/7 en un solape de un cuarto de lado', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 0, width: 10, height: 10 };
    expect(iou(a, b)).toBeCloseTo(50 / 150, 5);
  });
});
