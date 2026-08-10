import type { FormEvent } from 'react';
import { useState } from 'react';
import appPackage from '../../package.json';
import { useAuth } from '../contexts/AuthContext';
import { AuthChrome } from './auth/AuthChrome';
import { AuthForm } from './auth/AuthForm';
import { AuthLogo } from './auth/AuthLogo';
import { AuthSsoButton } from './auth/AuthSsoButton';
import { AuthVersion } from './auth/AuthVersion';

export function Auth() {
  const {
    signInWithSofia,
    learningSsoAvailable,
    signInWithLearningSso,
    cancelLearningSso,
    ssoPending,
    ssoError,
  } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) return;

    setError('');
    setLoading(true);
    try {
      const result = await signInWithSofia(identifier.trim(), password);
      if (!result.success) setError(result.error || 'Autenticacion fallida');
    } catch (err: any) {
      setError(err.message || 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthChrome>
      <AuthLogo />
      <AuthForm
        identifier={identifier}
        password={password}
        error={error}
        loading={loading}
        onIdentifierChange={setIdentifier}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
      />
      {/* Con el interruptor apagado no se monta: la pantalla queda idéntica a
          la anterior a este cambio. */}
      {learningSsoAvailable && (
        <AuthSsoButton
          disabled={loading}
          error={ssoError}
          pending={ssoPending}
          onCancel={cancelLearningSso}
          onStart={() => { void signInWithLearningSso(); }}
        />
      )}
      <AuthVersion version={appPackage.version} />
    </AuthChrome>
  );
}
