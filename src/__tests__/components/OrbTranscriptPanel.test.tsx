import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrbTranscriptPanel } from '../../components/orb/OrbTranscriptPanel';

const glow = { soft: 'rgba(0, 212, 179, 0.2)', text: '#ffffff' };

describe('OrbTranscriptPanel', () => {
  it('muestra el dictado sobre una superficie translúcida sin scrollbar visible', () => {
    render(
      <OrbTranscriptPanel
        errorMessage=""
        glow={glow}
        isListening={false}
        statusLabel="Pensando…"
        text="Una frase extensa que debe permanecer legible sobre cualquier fondo."
      />,
    );

    expect(screen.getByText('Pensando…')).toBeVisible();
    expect(screen.getByLabelText('Estado de la orbe')).toHaveClass('bg-slate-950/60', 'backdrop-blur-lg');
    expect(screen.getByLabelText('Texto dictado')).toHaveClass('bg-slate-950/70', 'backdrop-blur-xl');
    expect(screen.getByRole('log')).toHaveClass('no-scrollbar', 'max-h-24', 'overflow-y-auto');
  });

  it('usa un mensaje claro mientras todavía no existe transcripción', () => {
    render(
      <OrbTranscriptPanel
        errorMessage=""
        glow={glow}
        isListening
        statusLabel="Escuchando…"
        text=""
      />,
    );

    expect(screen.getByText('Te escucho…')).toBeVisible();
  });
});
