import { describe, expect, it } from 'vitest';
import { withSelectionContext } from '../hooks/chat-processor/process-message';

const NEWLINE = String.fromCharCode(10);
const seleccion = ['CONCEPTO 3.2', 'Synapse Bridge'].join(NEWLINE);

describe('Selección adjunta como contexto del turno', () => {
  it('SEL-001: el fragmento acompaña al turno citado y precede al mensaje', () => {
    const turno = withSelectionContext('que significa', seleccion);

    expect(turno).toContain('> CONCEPTO 3.2');
    expect(turno).toContain('> Synapse Bridge');
    // El mensaje del usuario va despues del material, no mezclado con el.
    expect(turno.indexOf('> CONCEPTO 3.2')).toBeLessThan(turno.indexOf('que significa'));
  });

  it('SEL-002: el turno no arrastra andamiaje interno', () => {
    const turno = withSelectionContext('mejora esto', seleccion);

    expect(turno).not.toContain('NO_CONFIABLE');
    expect(turno).not.toContain('Fuente:');
  });

  it('SEL-003: sin selección el turno es el texto tal cual', () => {
    expect(withSelectionContext('hola')).toBe('hola');
    expect(withSelectionContext('hola', '   ')).toBe('hola');
  });
});
