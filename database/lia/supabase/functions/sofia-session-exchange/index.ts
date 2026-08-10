// esm.sh y no `npm:`: el runtime del editor web del panel no resuelve el
// especificador npm y la funcion falla al arrancar, antes de ejecutar el
// handler. esm.sh funciona en ambas rutas de despliegue, CLI y panel.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { exchangeSofiaSession } from '../_shared/sofia-session-exchange-core.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const RESPONSE_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

Deno.serve(async (request: Request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    // Sin esta red, un fallo inesperado devuelve un 500 opaco y SIN cabeceras
    // CORS: el navegador solo ve "bloqueado por CORS" y la causa real queda
    // invisible. Aqui se convierte en la misma respuesta degradada que el
    // cliente ya sabe reintentar.
    console.error('[intercambio-sesion] fallo no controlado:', error instanceof Error ? error.message : 'desconocido');
    return jsonResponse(503, { code: 'exchange_unavailable' });
  }
});

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed' });

  const liaUrl = Deno.env.get('SUPABASE_URL') || '';
  const liaAdminKey = getLiaAdminKey();
  const sofiaUrl = Deno.env.get('SOFIA_SUPABASE_URL') || '';
  const sofiaAnonKey = Deno.env.get('SOFIA_SUPABASE_ANON_KEY') || '';

  if (!liaUrl || !liaAdminKey || !sofiaUrl || !sofiaAnonKey) {
    console.error('[intercambio-sesion] configuracion incompleta');
    return jsonResponse(503, { code: 'exchange_unavailable' });
  }

  const liaAdmin = createClient(liaUrl, liaAdminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await exchangeSofiaSession(request.headers.get('Authorization'), {
    getSofiaIdentity: async (accessToken) => {
      const sofia = createSofiaClient(sofiaUrl, sofiaAnonKey, accessToken);
      const { data, error } = await sofia.auth.getUser(accessToken);
      if (error) {
        if (error.status === 401 || error.status === 403) return null;
        throw new Error('identity_provider_unavailable');
      }
      if (!data.user) return null;
      return {
        id: data.user.id,
        email: data.user.email || null,
        emailVerified: Boolean(data.user.email_confirmed_at),
      };
    },
    getLegacyEmailVerification: async (accessToken, userId) => {
      const sofia = createSofiaClient(sofiaUrl, sofiaAnonKey, accessToken);
      const { data, error } = await sofia
        .from('users')
        .select('id, email, email_verified, email_verified_at')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error('legacy_email_verification_lookup_failed');
      if (!data) return null;
      return {
        id: data.id,
        email: data.email,
        emailVerified: data.email_verified === true,
        emailVerifiedAt: data.email_verified_at || null,
      };
    },
    hasActiveMembership: async (accessToken, userId) => {
      const sofia = createSofiaClient(sofiaUrl, sofiaAnonKey, accessToken);
      const { data, error } = await sofia
        .from('organization_users')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw new Error('membership_lookup_failed');
      return Boolean(data?.id);
    },
    generateOperationalAccess: async (email) => {
      const { data, error } = await liaAdmin.auth.admin.generateLink({ type: 'magiclink', email });
      if (error || !data.properties?.hashed_token || !data.user) {
        throw new Error('operational_link_failed');
      }
      return {
        tokenHash: data.properties.hashed_token,
        email: data.user.email || null,
      };
    },
  });

  if (result.status >= 500) console.error('[intercambio-sesion] servicio no disponible');
  return jsonResponse(result.status, result.body);
}

function createSofiaClient(url: string, anonKey: string, accessToken: string) {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function getLiaAdminKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (legacyKey) return legacyKey;

  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
    return keys.default || '';
  } catch {
    return '';
  }
}

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
}
