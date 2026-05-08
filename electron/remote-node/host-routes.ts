import type { IncomingMessage, ServerResponse } from 'node:http';
import { executeToolDirect } from '../computer-use-handlers';
import { REMOTE_NODE_CAPABILITIES } from './constants';
import { readJsonBody, sendJson } from './host-utils';
import type { RemoteNodeServerContext } from './types';

export async function dispatchHostRoute(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL,
  context: RemoteNodeServerContext,
): Promise<void> {
  const method = req.method || 'GET';
  if (method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(res, 200, {
      success: true,
      node_name: context.state.host.nodeName,
      local_url: context.getListeningUrl(),
      advertise_url: context.state.host.advertiseUrl || null,
      capabilities: [...REMOTE_NODE_CAPABILITIES],
    });
    return;
  }

  if (method === 'POST' && requestUrl.pathname === '/v1/open-application') {
    const body = await readJsonBody(req);
    sendJson(res, 200, await executeToolDirect('open_application', { path: body.path }));
    return;
  }

  if (method === 'POST' && requestUrl.pathname === '/v1/run-background-command') {
    const body = await readJsonBody(req);
    sendJson(res, 200, await executeToolDirect('run_background_command', {
      command: body.command,
      working_directory: body.working_directory,
      title: body.title,
    }));
    return;
  }

  if (method === 'POST' && requestUrl.pathname === '/v1/desktop/execute-task') {
    await executeDesktopTaskRoute(req, res, context);
    return;
  }

  if (method === 'GET' && requestUrl.pathname === '/v1/process-sessions') {
    sendJson(res, 200, await executeToolDirect('list_process_sessions', {}));
    return;
  }

  if (method === 'POST' && requestUrl.pathname === '/v1/take-screenshot') {
    const body = await readJsonBody(req);
    sendJson(res, 200, await executeToolDirect('take_screenshot', { display_id: body.display_id }));
    return;
  }

  await dispatchProcessSessionRoute(res, requestUrl.pathname, method);
}

async function executeDesktopTaskRoute(
  req: IncomingMessage,
  res: ServerResponse,
  context: RemoteNodeServerContext,
): Promise<void> {
  if (!context.deps?.desktopAgent) {
    sendJson(res, 503, { success: false, error: 'Desktop Agent no disponible en este nodo.' });
    return;
  }
  const body = await readJsonBody(req);
  const message = await context.deps.desktopAgent.executeTask(String(body.task || ''), {
    maxSteps: body.max_steps,
    backend: body.backend,
    startUrl: body.start_url,
    browserProfile: body.browser_profile,
    browserIsolated: body.browser_isolated,
    resetBrowserProfile: body.reset_browser_profile,
  });
  sendJson(res, 200, { success: true, message, status: context.deps.desktopAgent.getStatus() });
}

async function dispatchProcessSessionRoute(res: ServerResponse, pathname: string, method: string): Promise<void> {
  const sessionMatch = pathname.match(/^\/v1\/process-sessions\/([^/]+)$/);
  if (sessionMatch && method === 'GET') {
    const sessionId = decodeURIComponent(sessionMatch[1]);
    sendJson(res, 200, await executeToolDirect('poll_process_session', { session_id: sessionId }));
    return;
  }
  if (sessionMatch && method === 'DELETE') {
    const sessionId = decodeURIComponent(sessionMatch[1]);
    sendJson(res, 200, await executeToolDirect('kill_process_session', { session_id: sessionId }));
    return;
  }
  sendJson(res, 404, { success: false, error: 'Ruta remota no soportada.' });
}
