import { createSupabaseFetch } from '../../src/shared/supabase-http';

export interface IrisProjectScope { userId: string | null; organizationId: string | null; revision: number }
export interface IrisProjectSessionDependencies {
  scope(): IrisProjectScope;
  session(): Promise<{ userId: string; accessToken: string } | null>;
  publicKey(): string;
  fetch?: typeof globalThis.fetch;
}

/** El token sólo viaja de main a la instancia IRIS configurada; nunca al renderer. */
export function createIrisProjectFetch(origin: string, dependencies: IrisProjectSessionDependencies): typeof globalThis.fetch {
  const request = dependencies.fetch ?? createSupabaseFetch({ serviceName: 'IRIS-Main', stripIncomingSignal: true });
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const rest = url.pathname.startsWith('/rest/v1/');
    const signing = url.pathname.startsWith('/storage/v1/object/sign/project-files/');
    if (url.origin !== new URL(origin).origin || (!rest && !signing)) throw new Error('Destino de datos IRIS inválido.');
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    for (const name of ['x-soflia-token', 'x-soflia-key', 'x-soflia-organization']) headers.delete(name);
    // La firma histórica conserva la autorización IRIS y sus políticas de Storage.
    // La sesión de Learning sólo se entrega al verificador REST.
    if (signing) return request(input, { ...init, headers, redirect: 'error' });
    const selected = dependencies.scope();
    const session = selected.userId && selected.organizationId ? await dependencies.session() : null;
    const current = dependencies.scope();
    if (selected.userId !== current.userId || selected.organizationId !== current.organizationId || selected.revision !== current.revision) throw new Error('El ámbito de proyectos cambió durante la petición.');
    if (session && session.userId !== selected.userId) throw new Error('La sesión de Learning no coincide con el ámbito de proyectos.');
    if (session && selected.organizationId) {
      headers.set('x-soflia-token', session.accessToken);
      headers.set('x-soflia-key', dependencies.publicKey());
      headers.set('x-soflia-organization', selected.organizationId);
    }
    return request(input, { ...init, headers, redirect: 'error' });
  };
}
