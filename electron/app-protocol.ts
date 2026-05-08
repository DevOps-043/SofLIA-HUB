import crypto from 'node:crypto';
import type { AppProtocolCommand, MeetingTriggerAction, MeetingTriggerPayload } from './app-protocol/types';

function getOptionalQueryParam(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

function normalizeAction(value: string | null): MeetingTriggerAction {
  switch ((value || '').trim().toLowerCase()) {
    case 'stop':
      return 'stop';
    case 'heartbeat':
      return 'heartbeat';
    default:
      return 'start';
  }
}

function buildShareLink(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host !== 'share') {
    return null;
  }

  const pathname = url.pathname.replace(/^\/+/, '').trim();
  return pathname || null;
}

function buildMeetingTrigger(rawUrl: string, url: URL): MeetingTriggerPayload | null {
  const host = url.hostname.toLowerCase();
  if (host !== 'meeting-trigger') {
    return null;
  }

  return {
    action: normalizeAction(getOptionalQueryParam(url, 'action')),
    provider: getOptionalQueryParam(url, 'provider'),
    meetingTitle: getOptionalQueryParam(url, 'meetingTitle'),
    meetingUrl: getOptionalQueryParam(url, 'meetingUrl'),
    meetingCode: getOptionalQueryParam(url, 'meetingCode'),
    tabUrl: getOptionalQueryParam(url, 'tabUrl'),
    tabId: getOptionalQueryParam(url, 'tabId'),
    detectedAt: getOptionalQueryParam(url, 'detectedAt') || new Date().toISOString(),
    source: getOptionalQueryParam(url, 'source'),
    reason: getOptionalQueryParam(url, 'reason'),
    extensionVersion: getOptionalQueryParam(url, 'extensionVersion'),
    browser: getOptionalQueryParam(url, 'browser'),
    triggerId: getOptionalQueryParam(url, 'triggerId') || crypto.randomUUID(),
    rawUrl,
  };
}

export function extractProtocolArg(args: string[]): string | null {
  return args.find((arg) => typeof arg === 'string' && arg.toLowerCase().startsWith('soflia://')) || null;
}

export function parseAppProtocolCommand(rawValue: string | null | undefined): AppProtocolCommand {
  const rawUrl = String(rawValue || '').trim();
  if (!rawUrl) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol.toLowerCase() !== 'soflia:') {
    return null;
  }

  const shareLink = buildShareLink(url);
  if (shareLink) {
    return { type: 'share-link', shareLink, rawUrl };
  }

  const meetingTrigger = buildMeetingTrigger(rawUrl, url);
  return meetingTrigger ? { type: 'meeting-trigger', payload: meetingTrigger } : null;
}

export type { AppProtocolCommand, MeetingTriggerAction, MeetingTriggerPayload } from './app-protocol/types';
