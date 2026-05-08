import type { WhatsAppServiceCore } from './types';

export function addToGroupContext(
  service: WhatsAppServiceCore,
  jid: string,
  sender: string,
  text: string,
): void {
  if (!service.groupContext.has(jid)) service.groupContext.set(jid, []);
  const history = service.groupContext.get(jid)!;
  history.push({ sender, text, timestamp: Date.now() });
  if (history.length > 20) history.shift();
}

export function getGroupHistory(service: WhatsAppServiceCore, jid: string): string {
  const history = service.groupContext.get(jid) || [];
  if (history.length === 0) return '';
  return history
    .map((message) => `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.sender}: ${message.text}`)
    .join('\n');
}
