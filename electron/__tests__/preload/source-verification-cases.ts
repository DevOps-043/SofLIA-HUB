import { describe, expect, it } from 'vitest';
import { ALLOWED_IPC_CHANNELS, CSP_CONTENT, preloadSource } from './helpers';

describe('Preload source verification', () => {
  it('SEC-021: has 150+ allowed channels', () => {
    expect(ALLOWED_IPC_CHANNELS.length).toBeGreaterThanOrEqual(150);
  });

  it('SEC-022: computer namespace has 15+ channels', () => {
    expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('computer:')).length).toBeGreaterThanOrEqual(15);
  });

  it('SEC-023: whatsapp namespace is present', () => {
    expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('whatsapp:')).length).toBeGreaterThanOrEqual(5);
  });

  it('SEC-024: desktop-agent namespace has 15+ channels', () => {
    expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('desktop-agent:')).length).toBeGreaterThanOrEqual(15);
  });

  it('SEC-025: workspace namespaces are present', () => {
    for (const namespace of ['monitoring:', 'calendar:', 'gmail:', 'drive:', 'gchat:']) {
      expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith(namespace)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('SEC-026: CSP blocks unsafe-eval', () => {
    expect(CSP_CONTENT).toContain("script-src 'self'");
    expect(CSP_CONTENT).not.toContain('unsafe-eval');
  });

  it('SEC-027: CSP allows WebSocket connections', () => {
    expect(preloadSource).toContain('ws:');
    expect(preloadSource).toContain('wss:');
  });

  it('SEC-028: contextIsolation check is present', () => {
    expect(preloadSource).toContain('process.contextIsolated');
    expect(preloadSource).toContain('contextIsolation no esta habilitado');
  });

  it('SEC-029: contextBridge.exposeInMainWorld is called', () => {
    const exposeCount = (preloadSource.match(/(?:contextBridge|bridge)\.exposeInMainWorld/g) || []).length;
    expect(exposeCount).toBeGreaterThanOrEqual(3);
  });

  it('SEC-030: updater channels are present', () => {
    expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('updater:')).length).toBeGreaterThanOrEqual(4);
  });

  it('SEC-031: memory channels are present', () => {
    expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('memory:')).length).toBeGreaterThanOrEqual(3);
  });

  it('SEC-032: workflow-hub namespace is present', () => {
    expect(ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('workflow-hub:')).length).toBeGreaterThanOrEqual(6);
  });
});
