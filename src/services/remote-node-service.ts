import type { RegisterRemoteNodeInput, RemoteNodeHostStatus, RemoteNodeHostUpdates, RemoteNodeRecord, RemoteNodeHealthResult, RemoteNodeScreenshotResult } from '../shared/remote-node';
export type { RemoteNodeHostStatus, RemoteNodeRecord, RemoteNodeHealthResult, RemoteNodeScreenshotResult } from '../shared/remote-node';

export function isRemoteNodeAvailable(): boolean { return !!window.remoteNode; }

function getAPI() {
  if (!window.remoteNode) throw new Error('Remote Node API no disponible. Ejecuta SofLIA dentro de Electron.');
  return window.remoteNode;
}

export function getRemoteNodeHostStatus(): Promise<RemoteNodeHostStatus> { return getAPI().getHostStatus(); }
export function updateRemoteNodeHostConfig(updates: RemoteNodeHostUpdates): Promise<RemoteNodeHostStatus> { return getAPI().updateHostConfig(updates); }
export function listRemoteNodes(): Promise<{ success: boolean; nodes?: RemoteNodeRecord[]; error?: string }> { return getAPI().listNodes(); }
export function registerRemoteNode(node: RegisterRemoteNodeInput) { return getAPI().registerNode(node); }
export function removeRemoteNode(nodeId: string) { return getAPI().removeNode(nodeId); }
export function testRemoteNode(nodeId: string): Promise<RemoteNodeHealthResult> { return getAPI().testNode(nodeId); }

export async function takeRemoteNodeScreenshot(nodeId: string, args?: { display_id?: string }): Promise<RemoteNodeScreenshotResult> {
  const value = await getAPI().takeScreenshot(nodeId, args || {});
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.success !== 'boolean'
    || (value.image !== undefined && typeof value.image !== 'string')
    || (value.error !== undefined && typeof value.error !== 'string')) {
    throw new Error('La captura remota devolvió una respuesta no válida.');
  }
  return { ...value, success: value.success,
    ...(typeof value.image === 'string' ? { image: value.image } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
  };
}
