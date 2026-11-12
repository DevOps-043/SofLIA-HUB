import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrganizationLogo } from '../../components/sidebar/OrganizationLogo';

describe('Logo de organización', () => {
  it('recupera el logo heredado cuando falla la imagen de marca nueva', () => {
    render(<OrganizationLogo name="Empresa" logoUrl="/marca.png" legacyLogoUrl="/anterior.png" faviconUrl="/icono.png" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/anterior.png');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/icono.png');
  });
  it('prioriza el logo y recupera favicon e inicial ante errores', () => {
    render(<OrganizationLogo name="Empresa Demo" logoUrl="/demo.svg" faviconUrl="/favicon.png" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/demo.svg');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/favicon.png');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Organización Empresa Demo')).toHaveTextContent('E');
  });

  it('ignora URLs vacías y no reintenta una URL duplicada', () => {
    const { rerender } = render(<OrganizationLogo name="Demo" logoUrl="  " faviconUrl=" /icon.png " />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/icon.png');
    rerender(<OrganizationLogo name="Demo" logoUrl="/icon.png" faviconUrl=" /icon.png " />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('recupera los intentos al cambiar de organización o actualizar las URLs', () => {
    const { rerender } = render(<OrganizationLogo name="Demo" logoUrl="/logo.svg" />);
    fireEvent.error(screen.getByRole('img'));
    rerender(<OrganizationLogo name="Otra empresa" logoUrl="/logo.svg" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/logo.svg');
    fireEvent.error(screen.getByRole('img'));
    rerender(<OrganizationLogo name="Otra empresa" logoUrl="/nuevo.svg" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/nuevo.svg');
  });
});
