/**
 * Tests UI-001 to UI-015: Auth.tsx — Login form component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';

type MockMotionProps<T> = T & {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  variants?: unknown;
};

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: MockMotionProps<HTMLAttributes<HTMLDivElement>>) => <div {...filterMotionProps(props)}>{children}</div>,
    h1: ({ children, ...props }: MockMotionProps<HTMLAttributes<HTMLHeadingElement>>) => <h1 {...filterMotionProps(props)}>{children}</h1>,
    p: ({ children, ...props }: MockMotionProps<HTMLAttributes<HTMLParagraphElement>>) => <p {...filterMotionProps(props)}>{children}</p>,
    img: (props: MockMotionProps<ImgHTMLAttributes<HTMLImageElement>>) => <img {...filterMotionProps(props)} />,
    button: ({ children, ...props }: MockMotionProps<ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...filterMotionProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

function filterMotionProps<T extends object>(props: T): T {
  const motionKeys = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants']);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !motionKeys.has(key))) as T;
}

// Mock AuthContext
const mockSignInWithSofia = vi.fn();
const mockWindowControls = {
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn(),
  getPlatform: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithSofia: mockSignInWithSofia,
    user: null,
    dataUserId: null,
    loading: false,
    session: null,
    signOut: vi.fn(),
    usingSofia: true,
    sofiaContext: null,
    liaDegraded: false,
    liaStatusMessage: null,
    setCurrentOrganization: vi.fn(),
    setCurrentTeam: vi.fn(),
  }),
}));

import { Auth } from '../../components/Auth';

describe('Auth component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowControls.minimize.mockResolvedValue(undefined);
    mockWindowControls.maximize.mockResolvedValue(undefined);
    mockWindowControls.close.mockResolvedValue(undefined);
    mockWindowControls.isMaximized.mockResolvedValue(false);
    mockWindowControls.getPlatform.mockResolvedValue('win32');
    Object.defineProperty(window, 'windowControls', {
      configurable: true,
      value: mockWindowControls,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mockSignInWithSofia.mockResolvedValue({ success: true, user: { id: '1' }, session: {} });
  });

  // UI-001: Renders login form with email/password inputs
  it('UI-001: renders login form with identifier and password inputs', () => {
    render(<Auth />);

    const identifierInput = screen.getByPlaceholderText(/Usuario o Correo/i);
    const passwordInput = screen.getByPlaceholderText('Contraseña');

    expect(identifierInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // UI-002: Shows error in Spanish on failed login
  it('UI-002: shows error message in Spanish on failed login', async () => {
    mockSignInWithSofia.mockResolvedValue({
      success: false,
      user: null,
      session: null,
      error: 'Credenciales invalidas',
    });

    render(<Auth />);

    const identifierInput = screen.getByPlaceholderText(/Usuario o Correo/i);
    const passwordInput = screen.getByPlaceholderText('Contraseña');

    fireEvent.change(identifierInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const form = identifierInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Credenciales invalidas')).toBeInTheDocument();
    });
  });

  // UI-013: Submit button disabled during loading (empty fields = disabled)
  it('UI-013: submit button is disabled when fields are empty', () => {
    render(<Auth />);

    const submitButton = screen.getByRole('button', { name: /Iniciar Sesi/i });

    expect(submitButton).toBeDisabled();
  });

  // UI-014: Submit button enabled when fields have values
  it('UI-014: submit button is enabled with valid inputs', () => {
    render(<Auth />);

    const identifierInput = screen.getByPlaceholderText(/Usuario o Correo/i);
    const passwordInput = screen.getByPlaceholderText('Contraseña');

    fireEvent.change(identifierInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /Iniciar Sesi/i });
    expect(submitButton).not.toBeDisabled();
  });

  // UI-015: Password field uses type="password" (no toggle exists in this component)
  it('UI-015: password field has type password for security', () => {
    render(<Auth />);

    const passwordInput = screen.getByPlaceholderText('Contraseña');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('muestra una barra de título con los tres controles sin sesión', async () => {
    render(<Auth />);

    expect(screen.getAllByRole('banner', { name: 'Barra de título' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Minimizar ventana' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Maximizar ventana' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cerrar ventana' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Ver archivos de SofLIA' })).not.toBeInTheDocument();
    await waitFor(() => expect(mockWindowControls.getPlatform).toHaveBeenCalledOnce());
  });

  it('minimiza y cierra sin enviar ni borrar el formulario de acceso', async () => {
    render(<Auth />);
    const identifierInput = screen.getByPlaceholderText(/Usuario o Correo/i);
    const passwordInput = screen.getByPlaceholderText('Contraseña');
    fireEvent.change(identifierInput, { target: { value: 'usuario@ejemplo.com' } });
    fireEvent.change(passwordInput, { target: { value: 'clave-de-prueba' } });

    fireEvent.click(screen.getByRole('button', { name: 'Minimizar ventana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));

    await waitFor(() => {
      expect(mockWindowControls.minimize).toHaveBeenCalledOnce();
      expect(mockWindowControls.close).toHaveBeenCalledOnce();
    });
    expect(mockSignInWithSofia).not.toHaveBeenCalled();
    expect(identifierInput).toHaveValue('usuario@ejemplo.com');
    expect(passwordInput).toHaveValue('clave-de-prueba');
  });

  it('alterna entre maximizar y restaurar desde el acceso', async () => {
    render(<Auth />);
    await waitFor(() => expect(mockWindowControls.isMaximized).toHaveBeenCalledOnce());

    mockWindowControls.isMaximized.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Maximizar ventana' }));
    expect(await screen.findByRole('button', { name: 'Restaurar ventana' })).toHaveAttribute('title', 'Restaurar');

    mockWindowControls.isMaximized.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar ventana' }));
    expect(await screen.findByRole('button', { name: 'Maximizar ventana' })).toHaveAttribute('title', 'Maximizar');
    expect(mockWindowControls.maximize).toHaveBeenCalledTimes(2);
    expect(mockSignInWithSofia).not.toHaveBeenCalled();
  });

  it('refleja cambios de maximización iniciados desde el sistema', async () => {
    render(<Auth />);
    await waitFor(() => expect(mockWindowControls.isMaximized).toHaveBeenCalledOnce());

    mockWindowControls.isMaximized.mockResolvedValue(true);
    fireEvent(window, new Event('resize'));
    expect(await screen.findByRole('button', { name: 'Restaurar ventana' })).toBeEnabled();

    mockWindowControls.isMaximized.mockResolvedValue(false);
    fireEvent(window, new Event('resize'));
    expect(await screen.findByRole('button', { name: 'Maximizar ventana' })).toBeEnabled();
  });
});
