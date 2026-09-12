import { describe, expect, it } from 'vitest';
import { generateStrongPassword } from '../../services/password-generator';

describe('generador de contraseñas', () => {
  it('produce una candidata larga con las cuatro clases de caracteres', () => {
    const password = generateStrongPassword(24);
    expect(password).toHaveLength(24);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });
});
