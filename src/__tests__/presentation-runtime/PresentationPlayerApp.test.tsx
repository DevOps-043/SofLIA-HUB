import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PresentationPlayerApp } from '../../presentation-runtime/PresentationPlayerApp';

type RuntimeWindow = Window & {
  __PULSE_PRESENTATION__?: { deck: unknown; brandCss?: string; assets?: Record<string, string> };
};

afterEach(() => {
  cleanup();
  delete (window as RuntimeWindow).__PULSE_PRESENTATION__;
  document.head.querySelectorAll('[data-pulse-brand="embedded"]').forEach((node) => node.remove());
});

describe('reproductor declarativo de presentaciones', () => {
  it('renderiza una grafica con semantica accesible', async () => {
    (window as RuntimeWindow).__PULSE_PRESENTATION__ = {
      deck: {
        version: 1,
        meta: { titulo: 'Adopcion', direccionVisual: 'Editorial tecnica' },
        slides: [
          { id: 'inicio', tipo: 'portada', titulo: 'Adopcion medible', movimiento: { continuidad: 'flujo', entrada: 'revelado', enfasis: 'recorrido' } },
          {
            id: 'avance',
            tipo: 'grafica',
            titulo: 'La adopcion crece trimestre a trimestre',
            tipoGrafica: 'barras',
            categorias: ['T1', 'T2', 'T3'],
            series: [{ nombre: 'Equipos', valores: [12, 28, 47] }],
            unidad: '%',
            movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'conteo' },
          },
          { id: 'cierre', tipo: 'cierre', titulo: 'Decidir el piloto', accion: 'Iniciar', movimiento: { continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' } },
        ],
      },
    };

    render(<PresentationPlayerApp />);
    fireEvent.click(screen.getByLabelText('Diapositiva siguiente'));

    expect(await screen.findByLabelText('Grafica de La adopcion crece trimestre a trimestre')).toBeInTheDocument();
  });

  it('no salta diapositivas por pulsaciones repetidas durante una transicion', () => {
    vi.useFakeTimers();
    (window as RuntimeWindow).__PULSE_PRESENTATION__ = { deck: deckDeTresSlides() };
    render(<PresentationPlayerApp />);

    const siguiente = screen.getByLabelText('Diapositiva siguiente');
    fireEvent.click(siguiente);
    fireEvent.click(siguiente);

    expect(screen.getByText('Segunda escena')).toBeInTheDocument();
    expect(screen.queryByText('Tercera escena')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('aplica la paleta de fuente y evita bandas planas al contener una imagen', () => {
    (window as RuntimeWindow).__PULSE_PRESENTATION__ = {
      deck: {
        version: 1,
        meta: {
          titulo: 'Paleta fuente',
          direccionVisual: 'Editorial de la pagina observada',
          tema: {
            origen: 'fuente',
            fondo: '#08131f',
            texto: '#f7fbff',
            primario: '#5bd6ff',
            secundario: '#7a63ff',
            acento: '#ffb547',
            superficie: '#132538',
          },
        },
        slides: [
          {
            id: 'inicio', tipo: 'portada', variante: 'visual-dominante', titulo: 'Una fuente visual',
            imagen: { src: 'assets/diagrama.png', alt: 'Diagrama original', ajuste: 'contener', posicion: 'centro' },
            movimiento: { continuidad: 'flujo', entrada: 'revelado', enfasis: 'recorrido' },
          },
          { id: 'tesis', tipo: 'declaracion', variante: 'inmersiva', titulo: 'Una tesis', movimiento: { continuidad: 'zoom', entrada: 'foco', enfasis: 'ninguno' } },
          { id: 'cierre', tipo: 'cierre', variante: 'editorial', titulo: 'Decidir', accion: 'Continuar', movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'pulso' } },
        ],
      },
      assets: { 'assets/diagrama.png': 'data:image/png;base64,AAAA' },
    };

    render(<PresentationPlayerApp />);

    const stage = screen.getByLabelText('Paleta fuente').firstElementChild as HTMLElement;
    expect(stage.style.getPropertyValue('--marca-color-primario')).toBe('#5bd6ff');
    expect(stage.style.getPropertyValue('--deck-color-superficie')).toBe('#132538');
    const foreground = screen.getByAltText('Diagrama original');
    expect(foreground.parentElement).toHaveClass('runtime-image-stack');
    expect(foreground.parentElement?.querySelectorAll('img')).toHaveLength(2);
  });
});

function deckDeTresSlides() {
  return {
    version: 1,
    meta: { titulo: 'Navegacion', direccionVisual: 'Editorial' },
    slides: [
      { id: 'uno', tipo: 'portada', titulo: 'Primera escena', movimiento: { continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' } },
      { id: 'dos', tipo: 'declaracion', titulo: 'Segunda escena', movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'ninguno' } },
      { id: 'tres', tipo: 'cierre', titulo: 'Tercera escena', accion: 'Cerrar', movimiento: { continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' } },
    ],
  };
}
