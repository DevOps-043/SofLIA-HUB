import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MarkdownRenderer } from '../../components/chat/MarkdownRenderer';
import { cleanTeamText } from '../../shared/background-team-display';
it('valida el destino final del enlace aunque el Markdown anidado pase por limpieza', () => {
  render(<MarkdownRenderer text={cleanTeamText('[[Abrir](file:///interno)](file:///externo)\n\n[[Datos](data:text/html,inseguro)](data:text/html,inseguro)\n\n[Fuente](https://example.com/informe)')} />);
  const links = screen.getAllByRole('link'); expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute('href', 'https://example.com/informe');
});
it('rechaza credenciales y esquemas ejecutables sin ocultar la etiqueta del enlace', () => {
  render(<MarkdownRenderer text={'[Local](file:///C:/privado) [Script](javascript:alert) [Cuenta](https://usuario:clave@example.com)'} />);
  expect(screen.queryAllByRole('link')).toHaveLength(0); expect(screen.getByText('Local')).toBeInTheDocument();
});
