import { describe, expect, it } from 'vitest';
import { PublicClientApplication, ResponseMode, type INetworkModule, type NetworkRequestOptions, type NetworkResponse } from '@azure/msal-node';
import { google, Auth } from 'googleapis';
import { createOAuthProof, validateOAuthDestination } from '../calendar/oauth-proof';
import { OAUTH_REDIRECT_URI } from '../calendar/constants';

const clientId = '11111111-1111-4111-8111-111111111111';
const tenant = '22222222-2222-4222-8222-222222222222';
const authority = 'https://login.microsoftonline.com/common';
const metadata = {
  authorization_endpoint: authority + '/oauth2/v2.0/authorize', token_endpoint: authority + '/oauth2/v2.0/token',
  end_session_endpoint: authority + '/oauth2/v2.0/logout', issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
  jwks_uri: authority + '/discovery/v2.0/keys',
};
function fixture(returnedNonce: string) {
  const posts: Array<{ url: string; body: URLSearchParams }> = [];
  const network: INetworkModule = {
    async sendGetRequestAsync<T>(): Promise<NetworkResponse<T>> { throw new Error('La fixture no permite GET ni red externa.'); },
    async sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse<T>> {
      const target = new URL(url);
      expect(target.origin + target.pathname).toBe(metadata.token_endpoint);
      for (const key of target.searchParams.keys()) expect(key).toBe('client-request-id');
      posts.push({ url, body: new URLSearchParams(options?.body) });
      const now = Math.floor(Date.now() / 1000);
      // JWT sin firma válida: sólo contrato de parsing/nonce, no autenticación real.
      const idToken = [Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({ aud: clientId, iss: metadata.issuer, iat: now, nbf: now - 60, exp: now + 3600,
          oid: '33333333-3333-4333-8333-333333333333', sub: 'sujeto-ficticio', tid: tenant,
          preferred_username: 'cuenta@example.test', nonce: returnedNonce, ver: '2.0' })).toString('base64url'), 'firma-ficticia'].join('.');
      const body = { token_type: 'Bearer', access_token: 'token-ficticio', refresh_token: 'renovacion-ficticia',
        expires_in: 3600, ext_expires_in: 3600, scope: 'Calendars.Read User.Read', id_token: idToken };
      return { status: 200, headers: {}, body: body as T };
    },
  };
  const client = new PublicClientApplication({ auth: { clientId, authority, authorityMetadata: JSON.stringify(metadata),
    cloudDiscoveryMetadata: JSON.stringify({ tenant_discovery_endpoint: authority + '/v2.0/.well-known/openid-configuration',
      metadata: [{ preferred_network: 'login.microsoftonline.com', preferred_cache: 'login.microsoftonline.com', aliases: ['login.microsoftonline.com'] }] }) },
  system: { networkClient: network, loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } } });
  return { client, posts };
}

describe('SDK OAuth reales sin red externa', () => {
  it('MSAL público genera URL compatible y canjea sólo código con verifier y nonce', async () => {
    const proof = createOAuthProof(), nonce = createOAuthProof().state;
    const { client, posts } = fixture(nonce);
    const url = await client.getAuthCodeUrl({ scopes: ['Calendars.Read', 'User.Read'], redirectUri: OAUTH_REDIRECT_URI,
      state: proof.state, nonce, codeChallenge: proof.challenge, codeChallengeMethod: 'S256', responseMode: ResponseMode.QUERY });
    expect(() => validateOAuthDestination(url, 'microsoft', proof, clientId)).not.toThrow();
    const result = await client.acquireTokenByCode({ code: 'codigo-ficticio', scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI, state: proof.state, codeVerifier: proof.verifier, nonce });
    expect(result.accessToken).toBe('token-ficticio'); expect(result.account?.username).toBe('cuenta@example.test');
    expect(posts).toHaveLength(1); expect(posts[0].body.get('code')).toBe('codigo-ficticio');
    expect(posts[0].body.get('code_verifier')).toBe(proof.verifier); expect(posts[0].body.has('client_secret')).toBe(false);
  });
  it('MSAL rechaza nonce OIDC discordante de la respuesta controlada', async () => {
    const { client, posts } = fixture('nonce-ajeno');
    await expect(client.acquireTokenByCode({ code: 'codigo-ficticio', scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI, nonce: 'nonce-esperado', codeVerifier: createOAuthProof().verifier })).rejects.toMatchObject({ errorCode: 'nonce_mismatch' });
    expect(posts).toHaveLength(1);
  });
  it('Google genera URL con state y PKCE compatibles con la misma frontera', () => {
    const proof = createOAuthProof();
    const client = new google.auth.OAuth2('cliente-ficticio', 'credencial-ficticia', OAUTH_REDIRECT_URI);
    const url = client.generateAuthUrl({ scope: ['https://www.googleapis.com/auth/calendar.events'], state: proof.state,
      code_challenge: proof.challenge, code_challenge_method: Auth.CodeChallengeMethod.S256 });
    expect(() => validateOAuthDestination(url, 'google', proof, 'cliente-ficticio')).not.toThrow();
  });
});
