import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { OrbInfoPanel } from '../../components/orb/OrbInfoPanel';

const sources = [
  { uri: 'https://example.com/uno', title: 'Primera referencia' },
  { uri: 'https://example.com/dos', title: 'Segunda referencia' },
];

describe('OrbInfoPanel', () => {
  it('prioriza la respuesta y mantiene las fuentes colapsadas inicialmente', () => {
    render(<OrbInfoPanel responseText="Respuesta completa de SofLIA." sources={sources} />);

    expect(screen.getByText('Respuesta completa de SofLIA.')).toBeVisible();
    expect(screen.queryByText('Información verificada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mostrar 2 fuentes consultadas/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Primera referencia' })).not.toBeInTheDocument();
  });

  it('permite expandir y volver a colapsar todas las fuentes', async () => {
    const user = userEvent.setup();
    render(<OrbInfoPanel responseText="Respuesta." sources={sources} />);

    const toggle = screen.getByRole('button', { name: /mostrar 2 fuentes consultadas/i });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Primera referencia' })).toHaveAttribute('href', sources[0].uri);
    expect(screen.getByRole('link', { name: 'Segunda referencia' })).toHaveAttribute('href', sources[1].uri);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Primera referencia' })).not.toBeInTheDocument();
  });
});
