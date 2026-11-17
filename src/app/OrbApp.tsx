import { AuthProvider } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { OrbWindowRoot } from './OrbWindowRoot';

function OrbSurface() {
  useTheme();
  return <OrbWindowRoot />;
}

/** Voz, reuniones y autorización, sin consultas ni gestores del shell principal. */
export default function OrbApp() {
  return <AuthProvider><OrbSurface /></AuthProvider>;
}
