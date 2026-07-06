import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeSofliaLearningError, toRepositoryError } from './error-utils';
import {
  mapChannelDeliveryRow,
  mapNotificationPreferenceRow,
  mapNotificationRow,
  NOTIFICATION_CHANNEL_DELIVERY_SELECT,
  SOFLIA_LEARNING_TABLES,
  USER_NOTIFICATION_PREFERENCE_SELECT,
  USER_NOTIFICATION_SELECT,
} from './rows';
import type {
  ListNotificationPreferencesInput,
  ListPendingDeliveriesInput,
  ListUserNotificationsInput,
  MarkDeliveryFailedInput,
  MarkDeliverySentInput,
  SofliaLearningChannelDelivery,
  SofliaLearningNotification,
  SofliaLearningNotificationPreference,
  SofliaLearningRepositoryError,
  SofliaLearningResult,
} from './types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class SofliaLearningRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getNotificationById(notificationId: string): Promise<SofliaLearningResult<SofliaLearningNotification | null>> {
    const cleanNotificationId = normalizeRequiredString(notificationId);
    if (!cleanNotificationId) {
      return invalidInput('notificationId es requerido.');
    }

    const table = SOFLIA_LEARNING_TABLES.notifications;
    const { data, error } = await this.client
      .from(table)
      .select(USER_NOTIFICATION_SELECT)
      .eq('notification_id', cleanNotificationId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: toRepositoryError(error, table) };
    }

    return { ok: true, data: data ? mapNotificationRow(data) : null };
  }

  async listUserNotifications(
    input: ListUserNotificationsInput,
  ): Promise<SofliaLearningResult<SofliaLearningNotification[]>> {
    const userId = normalizeRequiredString(input.userId);
    if (!userId) {
      return invalidInput('userId es requerido.');
    }

    const table = SOFLIA_LEARNING_TABLES.notifications;
    let query = this.client
      .from(table)
      .select(USER_NOTIFICATION_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(normalizeLimit(input.limit));

    if (input.organizationId) {
      query = query.eq('organization_id', input.organizationId);
    }
    if (input.status) {
      query = query.eq('status', input.status);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: toRepositoryError(error, table) };
    }

    return { ok: true, data: Array.isArray(data) ? data.map(mapNotificationRow) : [] };
  }

  async listNotificationPreferences(
    input: ListNotificationPreferencesInput,
  ): Promise<SofliaLearningResult<SofliaLearningNotificationPreference[]>> {
    const userId = normalizeRequiredString(input.userId);
    if (!userId) {
      return invalidInput('userId es requerido.');
    }

    const table = SOFLIA_LEARNING_TABLES.preferences;
    let query = this.client
      .from(table)
      .select(USER_NOTIFICATION_PREFERENCE_SELECT)
      .eq('user_id', userId)
      .order('notification_type', { ascending: true })
      .limit(normalizeLimit(input.limit));

    if (input.notificationType) {
      query = query.eq('notification_type', input.notificationType);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: toRepositoryError(error, table) };
    }

    return { ok: true, data: Array.isArray(data) ? data.map(mapNotificationPreferenceRow) : [] };
  }

  async listPendingChannelDeliveries(
    input: ListPendingDeliveriesInput = {},
  ): Promise<SofliaLearningResult<SofliaLearningChannelDelivery[]>> {
    const table = SOFLIA_LEARNING_TABLES.deliveries;
    let query = this.client
      .from(table)
      .select(NOTIFICATION_CHANNEL_DELIVERY_SELECT)
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', input.nowIso || new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(normalizeLimit(input.limit));

    if (input.organizationId) {
      query = query.eq('organization_id', input.organizationId);
    }

    const channels = normalizeChannels(input.channels);
    if (channels.length > 0) {
      query = query.in('channel', channels);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: toRepositoryError(error, table) };
    }

    return { ok: true, data: Array.isArray(data) ? data.map(mapChannelDeliveryRow) : [] };
  }

  async markChannelDeliverySent(
    input: MarkDeliverySentInput,
  ): Promise<SofliaLearningResult<SofliaLearningChannelDelivery>> {
    const deliveryId = normalizeRequiredString(input.deliveryId);
    if (!deliveryId) {
      return invalidInput('deliveryId es requerido.');
    }

    const table = SOFLIA_LEARNING_TABLES.deliveries;
    const sentAt = input.sentAtIso || new Date().toISOString();
    const { data, error } = await this.client
      .from(table)
      .update({
        status: 'sent',
        sent_at: sentAt,
        provider_message_id: input.providerMessageId || null,
        last_error: null,
        updated_at: sentAt,
      })
      .eq('delivery_id', deliveryId)
      .select(NOTIFICATION_CHANNEL_DELIVERY_SELECT)
      .maybeSingle();

    if (error) {
      return { ok: false, error: toRepositoryError(error, table) };
    }
    if (!data) {
      return { ok: false, error: notFound(table, deliveryId) };
    }

    const delivery = mapChannelDeliveryRow(data);
    await this.syncNotificationChannelSent(delivery.notificationId, delivery.channel);
    return { ok: true, data: delivery };
  }

  async markChannelDeliveryFailed(
    input: MarkDeliveryFailedInput,
  ): Promise<SofliaLearningResult<SofliaLearningChannelDelivery>> {
    const deliveryId = normalizeRequiredString(input.deliveryId);
    if (!deliveryId) {
      return invalidInput('deliveryId es requerido.');
    }

    const table = SOFLIA_LEARNING_TABLES.deliveries;
    const updatedAt = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: 'failed',
      last_error: sanitizeSofliaLearningError(input.error),
      updated_at: updatedAt,
    };
    if (input.nextAttemptAtIso !== undefined) {
      payload.next_attempt_at = input.nextAttemptAtIso;
    }

    const { data, error } = await this.client
      .from(table)
      .update(payload)
      .eq('delivery_id', deliveryId)
      .select(NOTIFICATION_CHANNEL_DELIVERY_SELECT)
      .maybeSingle();

    if (error) {
      return { ok: false, error: toRepositoryError(error, table) };
    }
    if (!data) {
      return { ok: false, error: notFound(table, deliveryId) };
    }

    return { ok: true, data: mapChannelDeliveryRow(data) };
  }

  private async syncNotificationChannelSent(notificationId: string, channel: string): Promise<void> {
    const notification = await this.getNotificationById(notificationId);
    if (!notification.ok || !notification.data) {
      return;
    }

    const channelsPending = notification.data.channelsPending.filter((item) => item !== channel);
    const channelsSent = notification.data.channelsSent.includes(channel)
      ? notification.data.channelsSent
      : [...notification.data.channelsSent, channel];

    if (
      channelsPending.length === notification.data.channelsPending.length &&
      channelsSent.length === notification.data.channelsSent.length
    ) {
      return;
    }

    await this.client
      .from(SOFLIA_LEARNING_TABLES.notifications)
      .update({
        channels_pending: channelsPending,
        channels_sent: channelsSent,
        updated_at: new Date().toISOString(),
      })
      .eq('notification_id', notificationId);
  }
}

function normalizeRequiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
}

function normalizeChannels(channels: unknown): string[] {
  if (!Array.isArray(channels)) {
    return [];
  }
  return channels
    .map((channel) => typeof channel === 'string' ? channel.trim() : '')
    .filter((channel): channel is string => /^[a-z0-9_-]{2,32}$/i.test(channel));
}

function invalidInput<T>(message: string): SofliaLearningResult<T> {
  return {
    ok: false,
    error: { code: 'invalid_input', message },
  };
}

function notFound(table: string, id: string): SofliaLearningRepositoryError {
  return {
    code: 'not_found',
    table,
    message: `No se encontro ${id} en ${table}.`,
  };
}

