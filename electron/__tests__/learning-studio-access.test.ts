import { describe, expect, it, vi } from 'vitest';
import { requestLearningStudio } from '../learning-studio-access';
import { emptyStudioState } from '../../src/shared/live-studio-domain';
import { studioRequestSchema,studioResponseSchema } from '../../src/shared/live-studio.contract';

const user = '00000000-0000-4000-8000-000000000001', session = '00000000-0000-4000-8000-000000000031';
const input = { organization_slug: 'acme', session_id: session, operation: { type: 'snapshot' } };
const deps = { baseUrl: 'https://learning.test', getIdentity: async () => ({ userId: user, accessToken: 'privado' }) };
const snapshot = { user_id: user, session_id: session, title: 'Clase', server_time: '2026-10-12T20:00:00.000Z', can_manage: true, state: emptyStudioState(), asset_urls: {} };
describe('frontera HTTP del estudio', () => {
  it('negocia participación y distingue límite 429 sin exponer el mensaje arbitrario del servidor',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'detalle privado'}),{status:429}));
    expect(await requestLearningStudio(input,{...deps,fetcher})).toMatchObject({success:false,code:'rate_limited'});
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('participation_version');
    expect(fetcher.mock.calls[0][1].headers['X-Soflia-Studio-Participation']).toBe('1');
  });
  it('abre el instructor con API anterior estricta sin enviar el campo nuevo en JSON',async()=>{
    const legacyRequest=studioRequestSchema.omit({participation_version:true});
    expect(legacyRequest.safeParse({...input,participation_version:1}).success).toBe(false);
    const legacyState:Record<string,unknown>=structuredClone(snapshot.state);
    delete legacyState.reaction_events;delete legacyState.participation;
    const moderation:Record<string,unknown>={...snapshot.state.moderation};delete moderation.message_interval_seconds;
    const legacySnapshot={...snapshot,state:{...legacyState,moderation}};
    const fetcher=vi.fn().mockImplementation(async(_url,options)=>legacyRequest.safeParse(JSON.parse(options.body)).success?new Response(JSON.stringify({snapshot:legacySnapshot})):new Response(JSON.stringify({error:'Datos inválidos'}),{status:400}));
    const result=await requestLearningStudio({...input,participation_version:1},{...deps,fetcher});
    expect(result).toMatchObject({success:true,snapshot:{can_manage:true,user_id:user}});
    if(result.success)expect(result.snapshot).not.toHaveProperty('participation_version');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('conserva capacidad confirmada por servidor nuevo y no intenta degradar un 403',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({snapshot:{...snapshot,participation_version:1}}))).mockResolvedValueOnce(new Response('{}',{status:403}));
    expect(await requestLearningStudio(input,{...deps,fetcher})).toMatchObject({success:true,snapshot:{participation_version:1}});
    expect(await requestLearningStudio(input,{...deps,fetcher})).toMatchObject({success:false,code:'access_denied'});expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['Falta configurar Meeting SDK en Learning', 'configuración para habilitar el ingreso'],
    ['Zoom no autorizó al anfitrión; revisa el permiso ZAK', 'permisos de la conexión audiovisual'],
    ['Esta sesión aún no tiene reunión Zoom', 'aún no está preparada en Learning'],
  ])('traduce el diagnóstico audiovisual %s sin exponer el proveedor', async (error, expected) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status: 503 }));
    const result = await requestLearningStudio({ ...input, operation: { type: 'zoom' } }, { ...deps, fetcher });
    expect(result).toMatchObject({ success: false, code: 'unavailable', error: expect.stringContaining(expected) });
    if (!result.success) expect(result.error).not.toMatch(/Zoom|SDK|ZAK/);
  });
  it.each(['constructor', '__proto__', 'toString'])('no acepta propiedades heredadas como diagnóstico %s', async (error) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status: 503 }));
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toEqual({ success: false, code: 'unavailable', error: 'No se pudo conectar el estudio. Revisa la configuración de Learning.' });
  });
  it('rechaza payload inválido y origen no confiable antes de consultar', async () => {
    const fetcher = vi.fn();
    expect(await requestLearningStudio({ ...input, role: 'host' }, { ...deps, fetcher })).toMatchObject({ success: false });
    expect(await requestLearningStudio(input, { ...deps, baseUrl: 'https://attacker.test/?token=x', fetcher })).toMatchObject({ success: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('envía bearer solo al origen configurado y comprueba actor de retorno', async () => {
    studioResponseSchema.parse({ snapshot });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ snapshot }))).mockResolvedValueOnce(new Response(JSON.stringify({ snapshot: { ...snapshot, user_id: session } })));
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toMatchObject({ success: true });
    expect(fetcher).toHaveBeenCalledWith('https://learning.test/api/auth/live/studio', expect.objectContaining({ redirect: 'error', headers: expect.objectContaining({ Authorization: 'Bearer privado' }) }));
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toMatchObject({ success: false });
  });
  it('distingue conflictos y rechaza cambiar de cuenta durante la petición', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 409 })).mockResolvedValueOnce(new Response(JSON.stringify({ snapshot })));
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toMatchObject({ code: 'conflict' });
    const getIdentity = vi.fn().mockResolvedValueOnce({ userId: user, accessToken: 'privado' }).mockResolvedValueOnce(null);
    expect(await requestLearningStudio(input, { ...deps, fetcher, getIdentity })).toMatchObject({ code: 'not_ready' });
  });
  it('distingue el filtro web sin publicar de una sesión vencida y un permiso denegado', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'La sesión de Soflia Hub no es válida' }), { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 405 }));
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toEqual({ success: false, code: 'unavailable', error: 'El estudio de Learning todavía no está habilitado para Soflia Hub.' });
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toMatchObject({ code: 'not_ready', error: 'Learning no pudo validar tu sesión. Vuelve a iniciar sesión en Hub.' });
    expect(await requestLearningStudio(input, { ...deps, fetcher })).toMatchObject({ code: 'access_denied' });
    for (let index = 0; index < 2; index++) expect(await requestLearningStudio(input, { ...deps, fetcher })).toMatchObject({ code: 'unavailable' });
  });
  it('acota el cuerpo de error y no expone mensajes internos de Learning', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({error:'UNAUTHENTICATED',extra:'x'.repeat(5000)}),{status:401}))
      .mockResolvedValueOnce(new Response(JSON.stringify({error:'dato privado del servidor'}),{status:403}));
    expect(await requestLearningStudio(input,{...deps,fetcher})).toMatchObject({code:'not_ready'});
    expect(await requestLearningStudio(input,{...deps,fetcher})).toMatchObject({error:'Learning no autorizó esta operación.'});
  });
  it('revoca el aula si el handler informa que la sesión desapareció', async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({snapshot}))).mockResolvedValueOnce(new Response(JSON.stringify({error:'Sesión no encontrada'}),{status:404}));
    expect(await requestLearningStudio(input,{...deps,fetcher})).toMatchObject({success:true});
    expect(await requestLearningStudio(input,{...deps,fetcher})).toEqual({success:false,code:'access_denied',error:'Esta sesión ya no está disponible en tu organización.'});
  });
});
