import { describe, expect, it } from 'vitest';
import { presentationDeckSchema } from '../../shared/presentations/deck-schema';

function deck() {
  return {
    version: 1,
    meta: { titulo: 'Estrategia', direccionVisual: 'Plano editorial tecnico' },
    slides: [
      { id: 'portada', tipo: 'portada', titulo: 'Una tesis concreta', movimiento: { continuidad: 'flujo', entrada: 'revelado', enfasis: 'recorrido' } },
      { id: 'tesis', tipo: 'declaracion', titulo: 'La pregunta central', texto: 'Una idea, no un documento.', movimiento: { continuidad: 'zoom', entrada: 'foco', enfasis: 'ninguno' } },
      { id: 'cierre', tipo: 'cierre', titulo: 'El siguiente paso', accion: 'Validar', movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'pulso' } },
    ],
  };
}

describe('contrato deck.json', () => {
  it('acepta una narrativa compacta con movimiento HyperFrames', () => {
    expect(presentationDeckSchema.parse(deck()).slides).toHaveLength(3);
  });

  it('rechaza CSS, HTML o campos libres del modelo', () => {
    const value = deck() as ReturnType<typeof deck> & { css: string };
    value.css = '.slide { width: 30px }';
    expect(presentationDeckSchema.safeParse(value).success).toBe(false);
  });

  it('rechaza rutas de imagen fuera de assets', () => {
    const value = deck();
    Object.assign(value.slides[0], { imagen: { src: '../secreto.png', alt: 'Imagen', ajuste: 'cubrir', posicion: 'centro' } });
    expect(presentationDeckSchema.safeParse(value).success).toBe(false);
  });

  it('rechaza titulos que obligarian a reducir la tipografia', () => {
    const value = deck();
    value.slides[1].titulo = 'x'.repeat(119);
    expect(presentationDeckSchema.safeParse(value).success).toBe(false);
  });

  it('acepta la estructura editorial que produjo el agente runtime', () => {
    const value = deck() as unknown as Record<string, unknown> & { meta: Record<string, unknown>; slides: Record<string, unknown>[] };
    Object.assign(value.meta, {
      fuentes: [{ nombre: 'Pagina observada', url: 'https://example.com/', observada: '13 de agosto de 2026' }],
      notaFuente: 'Las cifras se atribuyen a la fuente observada.',
    });
    value.slides = [
      { id: 'portada', tipo: 'portada', titulo: 'Una tesis concreta', texto: 'Contexto ejecutivo', movimiento: { continuidad: 'flujo', entrada: 'revelado', enfasis: 'recorrido' } },
      { id: 'division', tipo: 'division', titulo: 'Cuatro señales', texto: 'Una lectura.', bloques: [{ titulo: 'Uno', texto: 'A' }, { titulo: 'Dos', texto: 'B' }], movimiento: { continuidad: 'empuje', entrada: 'trazo', enfasis: 'recorrido' } },
      { id: 'proceso', tipo: 'proceso', titulo: 'Cuatro pasos', texto: 'Recorrido.', pasos: [{ numero: '01', titulo: 'Uno' }, { numero: '02', titulo: 'Dos' }, { numero: '03', titulo: 'Tres' }], movimiento: { continuidad: 'flujo', entrada: 'ascenso', enfasis: 'recorrido' } },
      { id: 'cita', tipo: 'cita', titulo: 'Principios', citas: [{ texto: 'Claridad primero.', atribucion: 'Fuente A' }, { texto: 'Proposito siempre.', atribucion: 'Fuente B' }], movimiento: { continuidad: 'foco', entrada: 'revelado', enfasis: 'ninguno' } },
      { id: 'cierre', tipo: 'cierre', titulo: 'Siguiente paso', accion: 'Validar', puntos: ['Uno', 'Dos'], movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'pulso' } },
    ];
    expect(presentationDeckSchema.safeParse(value).success).toBe(true);
  });

  it('acepta graficas declarativas sin entregar coordenadas al modelo', () => {
    const value = deck();
    value.slides.splice(1, 1, {
      id: 'grafica',
      tipo: 'grafica',
      titulo: 'La adopcion reduce el tiempo de ejecucion',
      tipoGrafica: 'lineas',
      categorias: ['Enero', 'Febrero', 'Marzo'],
      series: [{ nombre: 'Horas', valores: [42, 31, 18] }],
      unidad: 'horas',
      movimiento: { continuidad: 'flujo', entrada: 'trazo', enfasis: 'recorrido' },
    } as never);

    expect(presentationDeckSchema.safeParse(value).success).toBe(true);
  });

  it('rechaza una grafica con series desalineadas', () => {
    const value = deck();
    value.slides.splice(1, 1, {
      id: 'grafica',
      tipo: 'grafica',
      titulo: 'La serie debe corresponder a sus categorias',
      tipoGrafica: 'barras',
      categorias: ['A', 'B', 'C'],
      series: [{ nombre: 'Valor', valores: [10, 20] }],
      movimiento: { continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' },
    } as never);

    expect(presentationDeckSchema.safeParse(value).success).toBe(false);
  });

  it('acepta una paleta de fuente explicita con contraste accesible', () => {
    const value = deck();
    Object.assign(value.meta, {
      tema: {
        origen: 'fuente',
        fondo: '#08131f',
        texto: '#f7fbff',
        primario: '#5bd6ff',
        secundario: '#7a63ff',
        acento: '#ffb547',
        superficie: '#132538',
      },
    });

    expect(presentationDeckSchema.safeParse(value).success).toBe(true);
  });

  it('rechaza una paleta de fuente que haria ilegible el texto', () => {
    const value = deck();
    Object.assign(value.meta, {
      tema: {
        origen: 'fuente',
        fondo: '#ffffff',
        texto: '#eeeeee',
        primario: '#f5f5f5',
        secundario: '#dddddd',
        acento: '#fafafa',
        superficie: '#ffffff',
      },
    });

    expect(presentationDeckSchema.safeParse(value).success).toBe(false);
  });

  it('rechaza firmas visuales repetidas cuando una baraja nueva declara variantes', () => {
    const value = deck();
    Object.assign(value.slides[0], { variante: 'editorial' });
    Object.assign(value.slides[1], { variante: 'inmersiva' });
    Object.assign(value.slides[2], { variante: 'editorial', tipo: 'portada' });
    delete (value.slides[2] as Record<string, unknown>).accion;

    const result = presentationDeckSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes('firma visual'))).toBe(true);
  });

});
