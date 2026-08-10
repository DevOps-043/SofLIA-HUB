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

  it('parses auth-callback commands', () => {
    const command = parseAppProtocolCommand('soflia://auth/callback?ticket=abc123&state=xyz789');

    expect(command?.type).toBe('auth-callback');
    if (command?.type === 'auth-callback') {
      expect(command.payload.ticket).toBe('abc123');
      expect(command.payload.state).toBe('xyz789');
      expect(command.payload.error).toBeNull();
    }
  });

  it('parses auth-callback errors without ticket', () => {
    const command = parseAppProtocolCommand('soflia://auth/callback?state=xyz789&error=access_denied');

    expect(command?.type).toBe('auth-callback');
    if (command?.type === 'auth-callback') {
      expect(command.payload.ticket).toBeNull();
      expect(command.payload.error).toBe('access_denied');
    }
  });

  it('rejects auth callbacks that cannot be correlated or acted upon', () => {
    // Sin `state` el renderer no puede comprobar que el retorno sea suyo.
    expect(parseAppProtocolCommand('soflia://auth/callback?ticket=abc123')).toBeNull();
    // Sin ticket ni error el retorno no dice nada.
    expect(parseAppProtocolCommand('soflia://auth/callback?state=xyz789')).toBeNull();
    // Ruta ajena bajo el mismo host.
    expect(parseAppProtocolCommand('soflia://auth/otra?state=xyz789&ticket=abc')).toBeNull();
  });

  it('returns null for unsupported urls', () => {
    expect(parseAppProtocolCommand('https://example.com')).toBeNull();
    expect(parseAppProtocolCommand('soflia://unknown/path')).toBeNull();
    // Un esquema ajeno no debe colarse aunque imite la ruta del retorno.
    expect(parseAppProtocolCommand('otraapp://auth/callback?state=xyz&ticket=abc')).toBeNull();
  });
});
