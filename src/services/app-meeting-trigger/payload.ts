import type { BrowserMeetingTriggerPayload } from '../meeting-auto-session-store';

function makeTriggerId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `meeting-trigger-${Date.now()}`;
}

export function normalizeString(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

export function normalizeTriggerPayload(payload: unknown): BrowserMeetingTriggerPayload | null {
  if (!payload || typeof payload !== 'object') return null;

  const input = payload as Record<string, unknown>;
  const action = normalizeString(input.action)?.toLowerCase();
  const normalizedAction: BrowserMeetingTriggerPayload['action'] =
    action === 'stop' || action === 'heartbeat' ? action : 'start';
  const triggerId = normalizeString(input.triggerId) || makeTriggerId();
  const rawUrl = normalizeString(input.rawUrl) || `soflia://meeting-trigger?action=${normalizedAction}`;

  return {
    action: normalizedAction,
    provider: normalizeString(input.provider),
    meetingTitle: normalizeString(input.meetingTitle),
    meetingUrl: normalizeString(input.meetingUrl),
    meetingCode: normalizeString(input.meetingCode),
    tabUrl: normalizeString(input.tabUrl),
    tabId: normalizeString(input.tabId),
    detectedAt: normalizeString(input.detectedAt) || new Date().toISOString(),
    source: normalizeString(input.source),
    reason: normalizeString(input.reason),
    extensionVersion: normalizeString(input.extensionVersion),
    browser: normalizeString(input.browser),
    triggerId,
    rawUrl,
  };
}
