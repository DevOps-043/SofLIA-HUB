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
});


