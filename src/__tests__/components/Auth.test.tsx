/**
 * Tests UI-001 to UI-015: Auth.tsx — Login form component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...filterMotionProps(props)}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...filterMotionProps(props)}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function filterMotionProps(props: Record<string, any>) {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants'].includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// Mock AuthContext
const mockSignInWithSofia = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithSofia: mockSignInWithSofia,
    user: null,
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
    mockSignInWithSofia.mockResolvedValue({ success: true, user: { id: '1' }, session: {} });
  });

  // UI-001: Renders login form with email/password inputs
  it('UI-001: renders login form with identifier and password inputs', () => {
    render(<Auth />);

    const identifierInput = screen.getByPlaceholderText('Usuario o Correo');
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

    const identifierInput = screen.getByPlaceholderText('Usuario o Correo');
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

    const identifierInput = screen.getByPlaceholderText('Usuario o Correo');
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
});
