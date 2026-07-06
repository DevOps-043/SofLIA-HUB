import type {
  SofliaLearningChannelDelivery,
  SofliaLearningNotification,
  SofliaLearningNotificationPreference,
} from './types';

export const SOFLIA_LEARNING_TABLES = {
  notifications: 'user_notifications',
  preferences: 'user_notification_preferences',
  deliveries: 'notification_channel_deliveries',
} as const;

export const USER_NOTIFICATION_SELECT = [
  'notification_id',
  'user_id',
  'organization_id',
  'group_id',
  'notification_type',
  'title',
  'message',
  'metadata',
  'priority',
  'status',
  'channels_sent',
  'channels_pending',
  'read_at',
  'expires_at',
  'dedup_key',
  'created_at',
  'updated_at',
].join(',');

export const USER_NOTIFICATION_PREFERENCE_SELECT = [
  'preference_id',
  'user_id',
  'notification_type',
  'in_app_enabled',
  'push_enabled',
  'email_enabled',
  'email_frequency',
  'timezone',
  'whatsapp_enabled',
  'created_at',
  'updated_at',
].join(',');

export const NOTIFICATION_CHANNEL_DELIVERY_SELECT = [
  'delivery_id',
  'notification_id',
  'user_id',
  'organization_id',
  'channel',
  'status',
  'destination',
  'payload',
  'attempts',
  'max_attempts',
  'next_attempt_at',
  'sent_at',
  'provider_message_id',
  'last_error',
  'created_at',
  'updated_at',
].join(',');

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function mapNotificationRow(row: any): SofliaLearningNotification {
  return {
    notificationId: row.notification_id,
    userId: row.user_id,
    organizationId: row.organization_id ?? null,
    groupId: row.group_id ?? null,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    metadata: asRecord(row.metadata),
    priority: row.priority,
    status: row.status,
    channelsSent: asStringArray(row.channels_sent),
    channelsPending: asStringArray(row.channels_pending),
    readAt: row.read_at ?? null,
    expiresAt: row.expires_at ?? null,
    dedupKey: row.dedup_key ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function mapNotificationPreferenceRow(row: any): SofliaLearningNotificationPreference {
  return {
    preferenceId: row.preference_id,
    userId: row.user_id,
    notificationType: row.notification_type,
    inAppEnabled: Boolean(row.in_app_enabled),
    pushEnabled: Boolean(row.push_enabled),
    emailEnabled: Boolean(row.email_enabled),
    whatsappEnabled: Boolean(row.whatsapp_enabled),
    emailFrequency: row.email_frequency ?? null,
    timezone: row.timezone ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function mapChannelDeliveryRow(row: any): SofliaLearningChannelDelivery {
  return {
    deliveryId: row.delivery_id,
    notificationId: row.notification_id,
    userId: row.user_id,
    organizationId: row.organization_id ?? null,
    channel: row.channel,
    status: row.status,
    destination: row.destination ?? null,
    payload: asRecord(row.payload),
    attempts: Number(row.attempts || 0),
    maxAttempts: Number(row.max_attempts || 0),
    nextAttemptAt: row.next_attempt_at ?? null,
    sentAt: row.sent_at ?? null,
    providerMessageId: row.provider_message_id ?? null,
    lastError: row.last_error ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

