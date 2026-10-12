import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserHomePage } from '../../components/browser/BrowserHomePage';

describe('portada en la interfaz existente', () => {
  it('busca con el puente de navegación sin reemplazar la ventana de la aplicación', () => {
    const navigate = vi.fn();
    render(<BrowserHomePage onNavigate={navigate} />);
    const field = screen.getByRole('searchbox', { name: 'Buscar en la web' });
    fireEvent.change(field, { target: { value: ' ideas & diseño ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(navigate).toHaveBeenCalledWith('https://www.google.com/search?q=ideas%20%26%20dise%C3%B1o');
  });

  it('conserva lo escrito durante estados de carga y rechaza sólo espacios', () => {
    const navigate = vi.fn();
    const view = render(<BrowserHomePage onNavigate={navigate} />);
    const field = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'mi búsqueda' } });
    const updatedNavigate = vi.fn();
    view.rerender(<BrowserHomePage onNavigate={updatedNavigate} />);
    expect(screen.getByRole('searchbox')).toBe(field);
    expect(field.value).toBe('mi búsqueda');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(navigate).not.toHaveBeenCalled();
    expect(updatedNavigate).not.toHaveBeenCalled();
  });
});
