import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserNavigationSafetyNotice } from '../../components/browser/BrowserNavigationSafetyNotice';
import type { BrowserNavigationSafetyVerdict } from '../../services/integrated-browser-service';

const verdict: BrowserNavigationSafetyVerdict = {
  action: 'warn', source: 'local', reason: 'La conexión no está cifrada.', checkedAt: new Date(0).toISOString(),
};

describe('avisos de navegación segura', () => {
  it('muestra la advertencia local sin presentarla como bloqueo', () => {
    render(<BrowserNavigationSafetyNotice verdict={verdict} />);
    expect(screen.getByRole('status')).toHaveTextContent('La conexión no está cifrada.');
    expect(screen.getByRole('status')).toHaveTextContent('revisión local');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['allow', 'warn'] as const)('distingue proveedor caído y revisión local %s', (action) => {
    render(<BrowserNavigationSafetyNotice verdict={{ ...verdict, action, source: 'degraded' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('La protección local sigue activa');
    expect(screen.getByRole('status')).toHaveTextContent('no se comprobó con el proveedor remoto');
    if (action === 'warn') expect(screen.getByRole('status')).toHaveTextContent(verdict.reason!);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('identifica el intento bloqueado y no ofrece saltarse la protección', () => {
    render(<BrowserNavigationSafetyNotice verdict={{ ...verdict, action: 'block', source: 'remote', reason: 'El proveedor bloqueó la navegación.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Último intento de navegación bloqueado');
    expect(screen.getByRole('alert')).toHaveTextContent('Aviso del proveedor');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('retira avisos al cambiar a un destino sin alerta y admite versiones antiguas de main', () => {
    const { rerender, container } = render(<BrowserNavigationSafetyNotice verdict={verdict} />);
    rerender(<BrowserNavigationSafetyNotice verdict={{ ...verdict, action: 'allow', reason: null }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<BrowserNavigationSafetyNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('representa texto como texto, nunca como HTML ejecutable', () => {
    const { container } = render(<BrowserNavigationSafetyNotice verdict={{ ...verdict, reason: '<img src=x onerror=alert(1)>' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('img')).toBeNull();
  });
});
