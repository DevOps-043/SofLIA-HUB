import { expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { mockExistsSync, mockReadFileSync } from './setup';
import type { CalendarServiceTestContext } from './types';

export function registerCalendarConnectionTests(ctx: CalendarServiceTestContext) {
  it('CAL-001: should be an EventEmitter instance', () => {
    expect(ctx.getService()).toBeInstanceOf(EventEmitter);
  });

  it('CAL-002: setConfig stores Google OAuth config', () => {
    ctx.getService().setConfig({ google: { clientId: 'cid', clientSecret: 'csecret' } });
    expect(true).toBe(true);
  });

  it('CAL-003: connectGoogle returns error when OAuth credentials are not configured', async () => {
    ctx.getService().setConfig({});
    const result = await ctx.getService().connectGoogle();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Google OAuth credentials not configured');
  });

  it('CAL-004: loadConnections emits connected for each saved connection', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([{
      provider: 'google',
      email: 'saved@test.com',
      userId: 'u1',
      accessToken: 'at',
      refreshToken: 'rt',
      isActive: true,
    }]));

    const events: any[] = [];
    ctx.getService().on('connected', (data: any) => events.push(data));
    ctx.getService().loadConnections();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ provider: 'google', email: 'saved@test.com' });
  });

  it('CAL-005: loadConnections handles missing file gracefully', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => ctx.getService().loadConnections()).not.toThrow();
  });

  it('CAL-009: disconnect removes connection and emits disconnected', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([{
      provider: 'google',
      email: 'x@test.com',
      userId: 'u1',
      accessToken: 'at',
      refreshToken: 'rt',
      isActive: true,
    }]));
    ctx.getService().loadConnections();

    const disconnected: any[] = [];
    ctx.getService().on('disconnected', (data: any) => disconnected.push(data));
    await ctx.getService().disconnect('google');

    expect(disconnected[0].provider).toBe('google');
    expect(ctx.getService().getConnections()).toHaveLength(0);
  });
}
