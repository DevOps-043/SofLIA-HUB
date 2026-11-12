import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { UserMenu } from '../../components/sidebar/UserMenu';
import type { SofiaOrganization } from '../../lib/sofia-client';

const organizations: SofiaOrganization[] = [
  { id: 'demo', name: 'Empresa Demo', slug: 'demo', logo_url: '/demo-alto.svg', is_active: true, created_at: '2026-01-01' },
  { id: 'otra', name: 'Otra empresa', slug: 'otra', brand_favicon_url: '/otra.png', is_active: true, created_at: '2026-01-01' },
];

function props() {
  return {
    isOpen: true, displayName: 'Ana', initials: 'A', userEmail: 'ana@example.test', avatarUrl: '/persona.png',
    orgName: 'Empresa Demo', orgLogoUrl: undefined, organizations, currentOrgId: 'demo',
    onSelectOrganization: vi.fn(), onToggleSidebar: vi.fn(), theme: 'dark' as const,
    onSetTheme: vi.fn(), onOpenSettings: vi.fn(), onSignOut: vi.fn(),
  };
}

describe('Menú con identidad de organización', () => {
  it.each([
    { isOpen: true, position: 'left' as const },
    { isOpen: false, position: 'left' as const },
    { isOpen: true, position: 'right' as const },
    { isOpen: true, position: 'bottom' as const },
  ])('muestra logo y nombre al expandir y abre el menú en $position, expandido=$isOpen', layout => {
    const menuProps = props();
    render(<UserMenu {...menuProps} {...layout} />);
    const trigger = screen.getByRole('button', { name: 'Menú de organización. Organización actual: Empresa Demo' });
    expect(within(trigger).getByRole('img')).toHaveAttribute('src', '/demo-alto.svg');
    if (layout.isOpen) {
      expect(within(trigger).getByText('Empresa Demo')).toBeVisible();
    } else {
      expect(within(trigger).queryByText('Empresa Demo')).not.toBeInTheDocument();
    }
    expect(screen.queryByAltText('Usuario')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    if (!layout.isOpen) expect(menuProps.onToggleSidebar).toHaveBeenCalledOnce();
  });

  it('usa el logo sin favicon en el selector y conserva la selección', () => {
    const menuProps = props();
    render(<UserMenu {...menuProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Menú de organización/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Empresa Demo'));
    expect(screen.getAllByAltText('Logo de Empresa Demo')).toHaveLength(3);
    const other = screen.getByRole('button', { name: /Otra empresa/ });
    expect(within(other).getByRole('img')).toHaveAttribute('src', '/otra.png');
    fireEvent.click(other);
    expect(menuProps.onSelectOrganization).toHaveBeenCalledWith('otra');
    expect(screen.queryByText('Configuración')).not.toBeInTheDocument();
  });

  it('mantiene la recuperación del logo activo aunque no esté en el directorio', () => {
    render(<UserMenu {...props()} organizations={[]} orgLogoUrl="/activo.svg" orgFaviconUrl="/favicon.svg" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/favicon.svg');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByLabelText('Organización Empresa Demo')).toHaveTextContent('E');
    expect(within(screen.getByRole('button', { name: /Menú de organización/ })).getByText('Empresa Demo')).toBeVisible();
    expect(screen.queryByAltText('Usuario')).not.toBeInTheDocument();
  });

  it('reinicia la imagen al cambiar entre organizaciones con el mismo nombre y URL', () => {
    const sameBrand = organizations.map(org => ({ ...org, name: 'Misma marca', logo_url: '/compartido.svg', brand_favicon_url: undefined }));
    const { rerender } = render(<UserMenu {...props()} organizations={sameBrand} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<UserMenu {...props()} organizations={sameBrand} currentOrgId="otra" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/compartido.svg');
  });

  it('conserva la identidad personal cuando no hay organización', () => {
    render(<UserMenu {...props()} organizations={[]} currentOrgId={undefined} orgName={undefined} />);
    expect(screen.getByRole('button', { name: /Menú de usuario.*Ana/ })).toBeInTheDocument();
    expect(screen.getByAltText('Usuario')).toHaveAttribute('src', '/persona.png');
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });
});
