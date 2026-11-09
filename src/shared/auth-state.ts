/** Estado observable: ninguna respuesta del canal contiene credenciales. */
export interface AuthStatePayload {
  authenticated: boolean;
  userId: string | null;
}

/** Credenciales de ida y selección privada; no forman parte del snapshot. */
export interface AuthStatePublication extends AuthStatePayload {
  organizationId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  sofiaAccessToken?: string | null;
  sofiaRefreshToken?: string | null;
}

export interface AuthStateReply {
  ok: boolean;
  state: AuthStatePayload;
  reason?: 'invalid_payload' | 'sofia_unverified' | 'sofia_revoked';
}
export interface AuthStateBridge {
  setState: (state: AuthStatePublication) => Promise<AuthStateReply>;
  getState: () => Promise<AuthStatePayload>;
}

export const AUTH_STATE_LIMITS = { id: 128, token: 65536 } as const;
