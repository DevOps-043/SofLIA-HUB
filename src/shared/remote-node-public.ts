import type { RemoteNodeHostStatus, RemoteNodeRecord } from './remote-node';

/** Las herramientas conversacionales necesitan estado, no credenciales de emparejamiento. */
export function publicRemoteHostStatus(value: RemoteNodeHostStatus) {
  const { token, ...status } = value;
  return { ...status, token_configured: Boolean(token) };
}

export function publicRemoteNodeRecord(value: RemoteNodeRecord) {
  const { token, ...node } = value;
  return { ...node, token_configured: Boolean(token) };
}
