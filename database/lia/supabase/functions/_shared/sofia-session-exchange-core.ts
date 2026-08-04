export type SofiaIdentity = {
  id: string;
  email: string | null;
  emailVerified: boolean;
};

export type OperationalAccess = {
  tokenHash: string;
  email: string | null;
};

export type SessionExchangeDependencies = {
  getSofiaIdentity: (accessToken: string) => Promise<SofiaIdentity | null>;
  hasActiveMembership: (accessToken: string, userId: string) => Promise<boolean>;
  generateOperationalAccess: (email: string) => Promise<OperationalAccess>;
};

export type SessionExchangeResult = {
  status: 200 | 401 | 403 | 503;
  body:
    | { tokenHash: string }
    | { code: 'not_authenticated' | 'access_denied' | 'exchange_unavailable' };
};

export function readBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

export async function exchangeSofiaSession(
  authorization: string | null,
  dependencies: SessionExchangeDependencies,
): Promise<SessionExchangeResult> {
  const accessToken = readBearerToken(authorization);
  if (!accessToken) return failure(401, 'not_authenticated');

  try {
    const identity = await dependencies.getSofiaIdentity(accessToken);
    const email = normalizeEmail(identity?.email);
    if (!identity?.id || !email || !identity.emailVerified) return failure(401, 'not_authenticated');

    const active = await dependencies.hasActiveMembership(accessToken, identity.id);
    if (!active) return failure(403, 'access_denied');

    const operationalAccess = await dependencies.generateOperationalAccess(email);
    if (
      !operationalAccess.tokenHash ||
      normalizeEmail(operationalAccess.email) !== email
    ) {
      return failure(503, 'exchange_unavailable');
    }

    return { status: 200, body: { tokenHash: operationalAccess.tokenHash } };
  } catch {
    return failure(503, 'exchange_unavailable');
  }
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || '';
}

function failure(
  status: 401 | 403 | 503,
  code: 'not_authenticated' | 'access_denied' | 'exchange_unavailable',
): SessionExchangeResult {
  return { status, body: { code } };
}
