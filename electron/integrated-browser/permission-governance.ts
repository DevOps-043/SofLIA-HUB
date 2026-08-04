import { dialog, type BrowserWindow, type Session, type WebContents } from 'electron';

const HITL_PERMISSIONS = new Set(['media', 'geolocation']);

export function configureIntegratedBrowserPermissions(input: {
  session: Session;
  getBrowserContents: () => WebContents | null;
  getParentWindow: () => BrowserWindow | null;
}): () => void {
  const approved = new Set<string>();
  const key = (origin: string, permission: string, scope: string) => `${normalizeOrigin(origin)}|${permission}|${scope}`;

  input.session.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (contents !== input.getBrowserContents() || !HITL_PERMISSIONS.has(permission)) return false;
    const scope = permission === 'media' ? resolveCheckedMediaScope(details) : '*';
    return scope !== null
      && (approved.has(key(origin, permission, scope)) || approved.has(key(origin, permission, '*')));
  });

  input.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (contents !== input.getBrowserContents() || !HITL_PERMISSIONS.has(permission)) {
      callback(false);
      return;
    }

    const origin = resolvePermissionOrigin(details, contents.getURL());
    const label = permission === 'media' ? resolveMediaLabel(details) : 'ubicacion';
    const parent = input.getParentWindow();
    const options = {
      type: 'question' as const,
      title: 'Permiso del navegador',
      message: `¿Permitir acceso a ${label}?`,
      detail: `${origin}\n\nEl permiso solo se concede a este origen dentro del navegador integrado.`,
      buttons: ['Denegar', 'Permitir'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const request = parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options);
    void request.then(({ response }) => {
      const granted = response === 1;
      if (granted) {
        for (const scope of resolveRequestedPermissionScopes(permission, details)) {
          approved.add(key(origin, permission, scope));
        }
      }
      callback(granted);
    }).catch(() => callback(false));
  });

  return () => {
    approved.clear();
    input.session.setPermissionCheckHandler(null);
    input.session.setPermissionRequestHandler(null);
  };
}

function resolveCheckedMediaScope(details: unknown): 'audio' | 'video' | null {
  if (!details || typeof details !== 'object') return null;
  const mediaType = (details as { mediaType?: unknown }).mediaType;
  return mediaType === 'audio' || mediaType === 'video' ? mediaType : null;
}

function resolveRequestedPermissionScopes(permission: string, details: unknown): string[] {
  if (permission !== 'media' || !details || typeof details !== 'object') return ['*'];
  const mediaTypes = (details as { mediaTypes?: unknown }).mediaTypes;
  if (!Array.isArray(mediaTypes)) return ['*'];
  const scopes = mediaTypes.filter((value): value is 'audio' | 'video' => value === 'audio' || value === 'video');
  return scopes.length ? [...new Set(scopes)] : ['*'];
}

function resolvePermissionOrigin(details: unknown, fallbackUrl: string): string {
  const candidate = details && typeof details === 'object'
    ? (details as { requestingUrl?: unknown; securityOrigin?: unknown })
    : {};
  const raw = typeof candidate.securityOrigin === 'string'
    ? candidate.securityOrigin
    : typeof candidate.requestingUrl === 'string'
      ? candidate.requestingUrl
      : fallbackUrl;
  try {
    return new URL(raw).origin;
  } catch {
    return 'Origen desconocido';
  }
}

function normalizeOrigin(raw: string): string {
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

function resolveMediaLabel(details: unknown): string {
  const mediaTypes = details && typeof details === 'object'
    ? (details as { mediaTypes?: unknown }).mediaTypes
    : null;
  if (!Array.isArray(mediaTypes)) return 'camara o microfono';
  const hasVideo = mediaTypes.includes('video');
  const hasAudio = mediaTypes.includes('audio');
  if (hasVideo && hasAudio) return 'camara y microfono';
  if (hasVideo) return 'camara';
  if (hasAudio) return 'microfono';
  return 'camara o microfono';
}
