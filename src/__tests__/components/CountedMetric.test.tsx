import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountedMetric } from '../../presentation-runtime/components/CountedMetric';
import { parsePresentationDeck } from '../../shared/presentations/deck-schema';

describe('métricas animadas con datos explícitos', () => {
  it('conserva el valor original cuando el movimiento está deshabilitado', () => {
    render(<CountedMetric value="$1.2M" count={{ numero: 1.2, prefijo: '$', sufijo: 'M', decimales: 1 }} enabled={false} />);
    expect(screen.getByLabelText('$1.2M')).toHaveTextContent('$1.2M');
  });
  it('no interpreta formatos textuales sin contrato numérico', () => {
    render(<CountedMetric value="Sin dato" enabled />); expect(screen.getByLabelText('Sin dato')).toHaveTextContent('Sin dato');
  });
  it('rechaza un contador no finito y conserva cifras documentales', () => {
    const deck = { version: 1, meta: { titulo: 'Demo', direccionVisual: 'Editorial' }, slides: [{ id: 'inicio', tipo: 'portada', titulo: 'Inicio' }, { id: 'datos', tipo: 'metricas', titulo: 'Datos', metricas: [{ valor: '12', etiqueta: 'A', conteo: { numero: Infinity } }, { valor: '20', etiqueta: 'B' }] }, { id: 'fin', tipo: 'cierre', titulo: 'Fin', accion: 'Continuar' }] };
    expect(() => parsePresentationDeck(deck)).toThrow();
  });
});
