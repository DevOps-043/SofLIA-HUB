import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { applyStudioCommand, projectStudioState, StudioDomainError } from '../../../src/shared/live-studio-domain';
import { exampleStudioState } from './example-state';
import { studioRequestSchema } from '../../../src/shared/live-studio.contract';

const session = '00000000-0000-4000-8000-000000000031';
const course = '00000000-0000-4000-8000-000000000021';
const org = '00000000-0000-4000-8000-000000000001';
const identities = {
  instructor: { id: '00000000-0000-4000-8000-000000000011', name: 'Instructor de prueba', canManage: true, courseId: course, status: 'live' },
  alumno: { id: '00000000-0000-4000-8000-000000000013', name: 'Participante de prueba', canManage: false, courseId: course, status: 'live' },
};
async function body(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > limit) throw new Error('Contenido demasiado grande'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
export function studioTestServer(): Plugin {
  let state = exampleStudioState();
  const commands = new Map<string, string>();
  const listeners = new Set<ServerResponse>();
  const uploads = new Map<string, { bytes: number; mime: string; content?: Buffer }>();
  const json = (response: ServerResponse, value: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  return { name: 'estudio-prueba-local', configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1:4321');
      if (!url.pathname.startsWith('/__studio')) return next();
      // Este servidor solo existe en la fixture local, nunca se empaqueta ni autentica cuentas reales.
      if (request.headers.host !== '127.0.0.1:4321' || request.headers.origin && request.headers.origin !== 'http://127.0.0.1:4321') return json(response, { error: 'Origen de prueba inválido' }, 403);
      const actor = url.searchParams.get('actor') === 'instructor' ? identities.instructor : url.searchParams.get('actor') === 'alumno' ? identities.alumno : null;
      if (url.pathname.startsWith('/__studio-assets/')) {
        const id = url.pathname.split('/').pop()!; const item = uploads.get(id);
        if (!item) return json(response, { error: 'Archivo no disponible' }, 404);
        if (request.method === 'PUT') {
          try { const content = await body(request, 25 * 1024 * 1024); if (content.length !== item.bytes) throw new Error('Tamaño incompatible'); item.content = content; return json(response, {}); }
          catch { return json(response, { error: 'Subida inválida' }, 400); }
        }
        if (request.method === 'GET' && item.content) { response.writeHead(200, { 'Content-Type': item.mime, 'X-Content-Type-Options': 'nosniff' }); response.end(item.content); return; }
        return json(response, { error: 'Archivo pendiente' }, 404);
      }
      if (!actor) return json(response, { error: 'Elige una identidad de prueba' }, 403);
      if (url.pathname === '/__studio-events' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        response.write('data: connected\n\n'); listeners.add(response);
        request.on('close', () => listeners.delete(response)); return;
      }
      if (url.pathname !== '/__studio' || request.method !== 'POST') return json(response, {}, 404);
      try {
        const input = studioRequestSchema.parse(JSON.parse((await body(request, 32768)).toString()));
        if (input.session_id !== session || input.organization_slug !== 'prueba') throw new Error('Sesión inválida');
        projectStudioState(state, actor, new Date().toISOString());
        const operation = input.operation;
        if (operation.type === 'zoom') return json(response, { success: false, code: 'unavailable', error: 'Zoom real requiere el SDK configurado y Learning publicado. Esta prueba local no crea reuniones.' });
        if (operation.type === 'upload') {
          if (!actor.canManage || uploads.size >= 20) throw new Error('No se puede subir más contenido');
          const id = randomUUID(); uploads.set(id, { bytes: operation.bytes, mime: operation.mime });
          return json(response, { success: true, upload: { path: `${org}/${session}/${id}`, token: 'prueba-local', url: `http://127.0.0.1:4321/__studio-assets/${id}` } });
        }
        if (operation.type === 'command') {
          const key = `${actor.id}:${operation.id}`, hash = createHash('sha256').update(JSON.stringify(operation.command)).digest('hex');
          if (commands.has(key) && commands.get(key) !== hash || !commands.has(key) && operation.command.type !== 'presence' && operation.revision !== state.revision) return json(response, { success: false, code: 'conflict', error: 'El estado cambió. Revisa la acción antes de repetirla.' });
          if (!commands.has(key)) {
            state = applyStudioCommand(state, operation.command, actor, operation.id, new Date().toISOString(), randomUUID);
            commands.set(key, hash); if (commands.size > 1000) commands.delete(commands.keys().next().value!);
            for (const listener of listeners) listener.write('data: changed\n\n');
          }
        }
        const asset_urls = Object.fromEntries([...uploads].filter(([, item]) => item.content).map(([id]) => [`${org}/${session}/${id}`, `http://127.0.0.1:4321/__studio-assets/${id}`]));
        return json(response, { success: true, snapshot: { participation_version:1, session_id: session, user_id: actor.id, title: 'Prueba funcional del estudio', can_manage: actor.canManage, server_time: new Date().toISOString(), state: projectStudioState(state, actor, new Date().toISOString()), asset_urls } });
      } catch (error) { return json(response, { success: false, code: error instanceof StudioDomainError && error.code === 'forbidden' ? 'access_denied' : error instanceof StudioDomainError && error.code==='rate_limited'?'rate_limited':'unavailable', error: error instanceof StudioDomainError ? error.message : 'Solicitud de prueba inválida' }); }
    });
    server.httpServer?.once('close', () => { for (const listener of listeners) listener.end(); listeners.clear(); uploads.clear(); });
  } };
}
