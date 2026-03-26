import { describe, expect, it } from 'vitest';
import { extractProtocolArg, parseAppProtocolCommand } from '../app-protocol';

describe('app-protocol', () => {
  it('extracts the first soflia protocol arg', () => {
    expect(extractProtocolArg(['--foo', 'soflia://share/abc123', '--bar'])).toBe('soflia://share/abc123');
    expect(extractProtocolArg(['--foo', '--bar'])).toBeNull();
  });

  it('parses share-link commands', () => {
    const command = parseAppProtocolCommand('soflia://share/token-123');
    expect(command).not.toBeNull();
    expect(command?.type).toBe('share-link');
    if (command?.type === 'share-link') {
      expect(command.shareLink).toBe('token-123');
      expect(command.rawUrl).toBe('soflia://share/token-123');
    }
  });

  it('parses meeting-trigger commands', () => {
    const command = parseAppProtocolCommand(
      'soflia://meeting-trigger?action=start&provider=google_meet&meetingTitle=Daily%20Sync&meetingCode=abc-defg-hij&meetingUrl=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij&tabUrl=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij&browser=chrome&source=dom-watch',
    );

    expect(command).not.toBeNull();
    expect(command?.type).toBe('meeting-trigger');
    if (command?.type === 'meeting-trigger') {
      expect(command.payload.action).toBe('start');
      expect(command.payload.provider).toBe('google_meet');
      expect(command.payload.meetingTitle).toBe('Daily Sync');
      expect(command.payload.meetingCode).toBe('abc-defg-hij');
      expect(command.payload.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
      expect(command.payload.tabUrl).toBe('https://meet.google.com/abc-defg-hij');
      expect(command.payload.browser).toBe('chrome');
      expect(command.payload.source).toBe('dom-watch');
      expect(command.payload.triggerId).toBeTruthy();
    }
  });

  it('defaults meeting-trigger action to start', () => {
    const command = parseAppProtocolCommand('soflia://meeting-trigger?meetingTitle=Sync');
    expect(command?.type).toBe('meeting-trigger');
    if (command?.type === 'meeting-trigger') {
      expect(command.payload.action).toBe('start');
    }
  });

  it('returns null for unsupported urls', () => {
    expect(parseAppProtocolCommand('https://example.com')).toBeNull();
    expect(parseAppProtocolCommand('soflia://unknown/path')).toBeNull();
  });
});
