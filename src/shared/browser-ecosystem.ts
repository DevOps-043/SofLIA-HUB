export const ECOSYSTEM_APPS = [
  { id: 'soflia-learning', title: 'SOFLIA LEARNING', url: 'https://soflia.ai', fallbackIcon: 'learning' },
  { id: 'soflia-engine', title: 'SofLIA Engine', url: 'https://soflia-coursegen.netlify.app/', fallbackIcon: 'engine' },
  { id: 'project-hub', title: 'Project Hub', url: 'https://sofliahub.netlify.app/', fallbackIcon: 'hub' },
] as const;

export const ECOSYSTEM_SESSION_PATH = '/api/auth/hub-session';

/** Coincidencia de origen completo: no acepta credenciales, puertos ni dominios parecidos. */
export function ecosystemOrigin(target: string, origins: readonly string[]): string | null {
  try {
    const url = new URL(target);
    return !url.username && !url.password && origins.includes(url.origin) ? url.origin : null;
  } catch { return null; }
}
