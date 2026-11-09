export type SofiaIdentity = {
  id: string;
  email: string | null;
  emailVerified: boolean;
};

export type OperationalAccess = {
  tokenHash: string;
  email: string | null;
  liaUserId: string;
};

export type LegacyEmailVerification = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
};

export type SessionExchangeDependencies = {
  getSofiaIdentity: (accessToken: string) => Promise<SofiaIdentity | null>;
  getLegacyEmailVerification: (accessToken: string, userId: string) => Promise<LegacyEmailVerification | null>;
  hasActiveMembership: (accessToken: string, userId: string) => Promise<boolean>;
  generateOperationalAccess: (email: string) => Promise<OperationalAccess>;
  recordFederatedIdentity: (sofiaUserId: string, liaUserId: string) => Promise<void>;
  reportUnavailable?: (stage: ExchangeStage) => void;
};

type ExchangeStage = 'sofia_identity' | 'legacy_email' | 'membership' | 'lia_access' | 'federated_identity';

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

  let stage: ExchangeStage = 'sofia_identity';
  const unavailable = () => {
    dependencies.reportUnavailable?.(stage);
    return failure(503, 'exchange_unavailable');
  };
  try {
    const identity = await dependencies.getSofiaIdentity(accessToken);
    const email = normalizeEmail(identity?.email);
    if (!identity?.id || !email) return failure(401, 'not_authenticated');

    stage = 'legacy_email';
    const legacyVerification = identity.emailVerified
      ? null
      : await dependencies.getLegacyEmailVerification(accessToken, identity.id);
    const emailVerified = identity.emailVerified || matchesVerifiedLegacyEmail(
      legacyVerification,
      identity.id,
      email,
    );
    if (!emailVerified) return failure(401, 'not_authenticated');

    stage = 'membership';
    const active = await dependencies.hasActiveMembership(accessToken, identity.id);
    if (!active) return failure(403, 'access_denied');

    stage = 'lia_access';
    const operationalAccess = await dependencies.generateOperationalAccess(email);
    if (
      !operationalAccess.tokenHash ||
      !operationalAccess.liaUserId ||
      normalizeEmail(operationalAccess.email) !== email
    ) {
      return unavailable();
    }
    stage = 'federated_identity';

    await dependencies.recordFederatedIdentity(identity.id, operationalAccess.liaUserId);

    return { status: 200, body: { tokenHash: operationalAccess.tokenHash } };
  } catch {
    return unavailable();
  }
}

export function matchesVerifiedLegacyEmail(
  verification: LegacyEmailVerification | null,
  authenticatedUserId: string,
  authenticatedEmail: string,
): boolean {
  return Boolean(
    verification?.id === authenticatedUserId &&
    normalizeEmail(verification.email) === normalizeEmail(authenticatedEmail) &&
    verification.emailVerified &&
    verification.emailVerifiedAt,
  );
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
