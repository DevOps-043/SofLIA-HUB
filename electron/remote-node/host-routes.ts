import type { IncomingMessage, ServerResponse } from 'node:http';
import { executeToolDirect } from '../computer-use-handlers';
import { REMOTE_NODE_CAPABILITIES } from './constants';
import { readJsonBody, sendJson } from './host-utils';
import { remoteBackgroundCommand, remoteDesktopTask, remoteNodeSessionId, remoteOpenApplication, remoteScreenshot } from '../../src/shared/remote-node-input';
import type { RemoteNodeServerContext } from './types';

export async function dispatchHostRoute(req: IncomingMessage, res: ServerResponse, requestUrl: URL, context: RemoteNodeServerContext): Promise<void> {
  context.assertCurrent(); const method = req.method || 'GET';
  const tool = async (name: string, args: Record<string, unknown>) => {
    context.assertCurrent(); const result: unknown = await executeToolDirect(name, args);
    context.assertCurrent(); sendJson(res, 200, result);
  };
  if (method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(res, 200, { success: true, node_name: context.state.host.nodeName, local_url: context.getListeningUrl(),
      advertise_url: context.state.host.advertiseUrl || null, capabilities: [...REMOTE_NODE_CAPABILITIES] }); return;
  }
  if (method === 'POST' && requestUrl.pathname === '/v1/open-application') {
    const body = remoteOpenApplication.parse(await readJsonBody(req, context)); await tool('open_application', body); return;
  }
  if (method === 'POST' && requestUrl.pathname === '/v1/run-background-command') {
    const body = remoteBackgroundCommand.parse(await readJsonBody(req, context)); await tool('run_background_command', body); return;
  }
  if (method === 'POST' && requestUrl.pathname === '/v1/take-screenshot') {
    const body = remoteScreenshot.parse(await readJsonBody(req, context)); await tool('take_screenshot', body); return;
  }
  if (method === 'POST' && requestUrl.pathname === '/v1/desktop/execute-task') {
    if (!context.deps?.desktopAgent) { sendJson(res, 503, { success: false, error: 'Desktop Agent no disponible en este nodo.' }); return; }
    const body = remoteDesktopTask.parse(await readJsonBody(req, context)); context.assertCurrent();
    const message = await context.deps.desktopAgent.executeTask(body.task, { maxSteps: body.max_steps, backend: body.backend, startUrl: body.start_url,
      browserProfile: body.browser_profile, browserIsolated: body.browser_isolated, resetBrowserProfile: body.reset_browser_profile, signal: context.signal });
    context.assertCurrent(); sendJson(res, 200, { success: true, message, status: context.deps.desktopAgent.getStatus() }); return;
  }
  if (method === 'GET' && requestUrl.pathname === '/v1/process-sessions') { await tool('list_process_sessions', {}); return; }
  const match = requestUrl.pathname.match(/^\/v1\/process-sessions\/([^/]+)$/);
  if (match && (method === 'GET' || method === 'DELETE')) {
    const id = remoteNodeSessionId.parse(decodeURIComponent(match[1]));
    await tool(method === 'GET' ? 'poll_process_session' : 'kill_process_session', { session_id: id }); return;
  }
  sendJson(res, 404, { success: false, error: 'Ruta remota no soportada.' });
}
