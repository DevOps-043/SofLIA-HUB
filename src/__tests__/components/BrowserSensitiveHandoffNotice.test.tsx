import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BrowserSensitiveHandoffNotice } from '../../components/browser/BrowserSensitiveHandoffNotice';

it('explica el traspaso a la persona sin botón para aprobar acciones sensibles', () => {
  const view = render(<BrowserSensitiveHandoffNotice handoff={{ reason: 'autofill' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('gestor de contraseñas');
  expect(screen.getByRole('alert')).toHaveTextContent('espera a que termine');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(<BrowserSensitiveHandoffNotice handoff={null} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
