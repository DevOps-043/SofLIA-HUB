import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { BrowserWindow } from 'electron';
import type { CalendarService } from '../calendar-service';
import { calendarSession } from '../calendar/session-context';
import { OAUTH_REDIRECT_URI } from '../calendar/constants';
import { openOAuthWindow } from '../calendar/oauth-window';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { ProjectLocationStore } from './location-store';

const scopes = ['Files.ReadWrite', 'User.Read'];
const recordSchema = z.object({ email: z.string().min(1).max(320), homeAccountId: z.string().min(1).max(1024), cache: z.string().min(1).max(110_000) }).strict();

/** Autorización de archivos separada de los permisos y credenciales de calendario. */
export class MicrosoftFilesAuth {
  private authorizing = false;
  private tokenQueue: Promise<unknown> = Promise.resolve();
  constructor(private readonly calendar: CalendarService, private readonly store: Pick<ProjectLocationStore, 'read' | 'write'>) {}
  private context(auth: ProjectHubOperationAuthorization) {
    auth.assertCurrent();
    const connection = this.calendar.connections.get('microsoft');
    if (this.calendar.userId !== auth.userId || !connection?.isActive || !connection.email || connection.userId !== auth.userId) throw new Error('Vincula tu cuenta de Microsoft en Ajustes > Conexiones.');
    const session = calendarSession(this.calendar, connection);
    const assert = () => { auth.assertCurrent(); session(); };
    return { email: connection.email, assert, assertAccount: session, key: `microsoft-files/${connection.email.toLowerCase()}` };
  }
  async authorized(auth: ProjectHubOperationAuthorization) {
    const context = this.context(auth);
    const record = await this.store.read(auth.userId, context.key, context.assert);
    return recordSchema.safeParse(record).success;
  }
  async authorize(auth: ProjectHubOperationAuthorization, parent: BrowserWindow) {
    if (this.authorizing) throw new Error('Ya hay una autorización de OneDrive en curso.');
    this.authorizing = true;
    try {
      const context = this.context(auth);
      if (!this.calendar.config.microsoft?.clientId) throw new Error('La conexión de Microsoft no está configurada.');
      const { PublicClientApplication, CryptoProvider } = await import('@azure/msal-node');
      context.assert();
      const application = new PublicClientApplication({ auth: { clientId: this.calendar.config.microsoft.clientId, authority: 'https://login.microsoftonline.com/common' } });
      const pkce = await new CryptoProvider().generatePkceCodes();
      const state = randomBytes(32).toString('base64url');
      const url = await application.getAuthCodeUrl({ scopes, redirectUri: OAUTH_REDIRECT_URI, loginHint: context.email, codeChallenge: pkce.challenge, codeChallengeMethod: 'S256', state });
      context.assert();
      const code = await openOAuthWindow(url, 'OneDrive', { state, signal: auth.signal, parent });
      context.assert();
      if (!code) return false;
      const result = await application.acquireTokenByCode({ code, scopes, redirectUri: OAUTH_REDIRECT_URI, codeVerifier: pkce.verifier });
      context.assert();
      if (!result.account || result.account.username.toLowerCase() !== context.email.toLowerCase() || !result.scopes.some(scope => /(?:^|\/)Files\.ReadWrite$/i.test(scope))) throw new Error('Autoriza OneDrive con la misma cuenta Microsoft que vinculaste.');
      const record = recordSchema.parse({ email: context.email, homeAccountId: result.account.homeAccountId, cache: application.getTokenCache().serialize() });
      await this.store.write(auth.userId, context.key, record, context.assert);
      return true;
    } finally { this.authorizing = false; }
  }
  token(auth: ProjectHubOperationAuthorization) {
    const task = this.tokenQueue.then(() => this.acquire(auth));
    this.tokenQueue = task.catch(() => {});
    return task;
  }
  private async acquire(auth: ProjectHubOperationAuthorization) {
    const context = this.context(auth);
    const record = recordSchema.safeParse(await this.store.read(auth.userId, context.key, context.assert));
    if (!record.success || !this.calendar.config.microsoft?.clientId) throw new Error('Autoriza el acceso a archivos de OneDrive para continuar.');
    const { PublicClientApplication } = await import('@azure/msal-node');
    context.assert();
    const application = new PublicClientApplication({ auth: { clientId: this.calendar.config.microsoft.clientId, authority: 'https://login.microsoftonline.com/common' } });
    application.getTokenCache().deserialize(record.data.cache);
    const account = await application.getTokenCache().getAccountByHomeId(record.data.homeAccountId);
    context.assert();
    if (!account || account.username.toLowerCase() !== context.email.toLowerCase()) throw new Error('La cuenta vinculada a OneDrive cambió.');
    const token = await application.acquireTokenSilent({ account, scopes });
    context.assert();
    if (!token?.accessToken || token.account?.homeAccountId !== record.data.homeAccountId || token.account.username.toLowerCase() !== context.email.toLowerCase()) throw new Error('Vuelve a autorizar OneDrive con la cuenta vinculada.');
    await this.store.write(auth.userId, context.key, { ...record.data, cache: application.getTokenCache().serialize() }, context.assert);
    return { token: token.accessToken, email: context.email, assert: context.assert, assertAccount: context.assertAccount };
  }
}
