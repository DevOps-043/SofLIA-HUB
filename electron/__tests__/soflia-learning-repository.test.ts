import { describe, expect, it } from 'vitest';
import { readSofliaLearningConfigFromEnv } from '../soflia-learning/config';
import { SofliaLearningRepository } from '../soflia-learning/repository';

interface FakeResult {
  data: any;
  error: any;
}

class FakeQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];
  updatePayload: Record<string, unknown> | null = null;

  constructor(private readonly result: FakeResult) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  in(...args: unknown[]) {
    this.calls.push({ method: 'in', args });
    return this;
  }

  lte(...args: unknown[]) {
    this.calls.push({ method: 'lte', args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: 'order', args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ method: 'limit', args });
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    this.calls.push({ method: 'update', args: [payload] });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  queries: Array<{ table: string; query: FakeQuery }> = [];
  private queuedResults = new Map<string, FakeResult[]>();

  enqueue(table: string, result: FakeResult) {
    const current = this.queuedResults.get(table) || [];
    current.push(result);
    this.queuedResults.set(table, current);
  }

  from(table: string) {
    const results = this.queuedResults.get(table) || [];
    const query = new FakeQuery(results.shift() || { data: null, error: null });
    this.queries.push({ table, query });
    return query;
  }
}

const notificationRow = {
  notification_id: 'notif-1',
  user_id: 'user-1',
  organization_id: 'org-1',
  group_id: null,
  notification_type: 'learning_daily_summary',
  title: 'Titulo',
  message: 'Mensaje',
  metadata: { action_url: 'https://example.com' },
  priority: 'medium',
  status: 'unread',
  channels_sent: ['in_app'],
  channels_pending: ['whatsapp'],
  read_at: null,
  expires_at: null,
  dedup_key: 'daily-user-1',
  created_at: '2026-07-03T10:00:00.000Z',
  updated_at: '2026-07-03T10:00:00.000Z',
};

const deliveryRow = {
  delivery_id: 'delivery-1',
  notification_id: 'notif-1',
  user_id: 'user-1',
  organization_id: 'org-1',
  channel: 'whatsapp',
  status: 'sent',
  destination: '+5215512345678',
  payload: { title: 'Titulo', message: 'Mensaje' },
  attempts: 1,
  max_attempts: 5,
  next_attempt_at: '2026-07-03T10:00:00.000Z',
  sent_at: '2026-07-03T10:01:00.000Z',
  provider_message_id: 'wa-msg-1',
  last_error: null,
  created_at: '2026-07-03T10:00:00.000Z',
  updated_at: '2026-07-03T10:01:00.000Z',
};

describe('SofliaLearningRepository', () => {
  it('lee configuracion desde entorno sin requerir URLs hardcodeadas', () => {
    const config = readSofliaLearningConfigFromEnv({
      SOFLIA_LEARNING_SUPABASE_URL: 'https://learning-ref.supabase.co',
      SOFLIA_LEARNING_SUPABASE_ANON_KEY: 'anon-key',
    } as unknown as NodeJS.ProcessEnv);

    expect(config.configured).toBe(true);
    expect(config.keyKind).toBe('anon');
    expect(config.projectRef).toBe('learning-ref');

    const serviceRoleConfig = readSofliaLearningConfigFromEnv({
      SOFLIA_LEARNING_SUPABASE_URL: 'https://learning-ref.supabase.co',
      SOFLIA_LEARNING_SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SOFLIA_LEARNING_ALLOW_DESKTOP_SERVICE_ROLE: 'true',
    } as unknown as NodeJS.ProcessEnv);

    expect(serviceRoleConfig.configured).toBe(true);
    expect(serviceRoleConfig.keyKind).toBe('service_role');
  });

  it('consulta user_notifications con filtros y limite acotado', async () => {
    const supabase = new FakeSupabase();
    supabase.enqueue('user_notifications', { data: [notificationRow], error: null });
    const repository = new SofliaLearningRepository(supabase as any);

    const result = await repository.listUserNotifications({
      userId: 'user-1',
      organizationId: 'org-1',
      status: 'unread',
      limit: 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data[0].notificationId : null).toBe('notif-1');
    const query = supabase.queries[0].query;
    expect(query.calls).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'eq', args: ['organization_id', 'org-1'] },
      { method: 'eq', args: ['status', 'unread'] },
      { method: 'limit', args: [200] },
    ]));
  });

  it('reporta missing_table cuando notification_channel_deliveries no esta migrada', async () => {
    const supabase = new FakeSupabase();
    supabase.enqueue('notification_channel_deliveries', {
      data: null,
      error: {
        code: 'PGRST205',
        message: 'Could not find the table public.notification_channel_deliveries in the schema cache',
      },
    });
    const repository = new SofliaLearningRepository(supabase as any);

    const result = await repository.listPendingChannelDeliveries({
      channels: ['whatsapp', '../../bad-channel', 'telegram'],
      nowIso: '2026-07-03T10:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe('missing_table');
    expect(result.ok ? null : result.error.table).toBe('notification_channel_deliveries');
    expect(supabase.queries[0].query.calls).toEqual(expect.arrayContaining([
      { method: 'in', args: ['channel', ['whatsapp', 'telegram']] },
    ]));
  });

  it('marca entregas como sent y sincroniza canales de la notificacion', async () => {
    const supabase = new FakeSupabase();
    supabase.enqueue('notification_channel_deliveries', { data: deliveryRow, error: null });
    supabase.enqueue('user_notifications', { data: notificationRow, error: null });
    supabase.enqueue('user_notifications', { data: null, error: null });
    const repository = new SofliaLearningRepository(supabase as any);

    const result = await repository.markChannelDeliverySent({
      deliveryId: 'delivery-1',
      providerMessageId: 'wa-msg-1',
      sentAtIso: '2026-07-03T10:01:00.000Z',
    });

    expect(result.ok).toBe(true);
    const deliveryUpdate = supabase.queries[0].query.updatePayload;
    expect(deliveryUpdate).toMatchObject({
      status: 'sent',
      provider_message_id: 'wa-msg-1',
      last_error: null,
    });

    const notificationUpdate = supabase.queries[2].query.updatePayload;
    expect(notificationUpdate).toMatchObject({
      channels_pending: [],
      channels_sent: ['in_app', 'whatsapp'],
    });
  });
});
