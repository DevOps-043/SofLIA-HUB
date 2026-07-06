import type { SupabaseClient } from '@supabase/supabase-js';

export type SofliaLearningKeyKind = 'anon' | 'service_role';
export type SofliaLearningConfigSource = 'env' | 'secure_local' | 'missing';

export interface SofliaLearningConfig {
  configured: boolean;
  source: SofliaLearningConfigSource;
  url: string;
  key: string;
  keyKind: SofliaLearningKeyKind | null;
  projectRef: string | null;
  error?: string;
}

export interface SofliaLearningClientBundle {
  client: SupabaseClient;
  config: SofliaLearningConfig;
}

export interface SofliaLearningClientResult {
  bundle: SofliaLearningClientBundle | null;
  error?: string;
  config: SofliaLearningConfig;
}

export type SofliaLearningRepositoryErrorCode =
  | 'invalid_input'
  | 'missing_table'
  | 'not_found'
  | 'query_failed';

export interface SofliaLearningRepositoryError {
  code: SofliaLearningRepositoryErrorCode;
  message: string;
  table?: string;
}

export type SofliaLearningResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SofliaLearningRepositoryError };

export type SofliaLearningNotificationStatus = 'unread' | 'read' | 'archived';

export interface SofliaLearningNotification {
  notificationId: string;
  userId: string;
  organizationId: string | null;
  groupId: string | null;
  notificationType: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  priority: 'critical' | 'high' | 'medium' | 'low' | string;
  status: SofliaLearningNotificationStatus | string;
  channelsSent: string[];
  channelsPending: string[];
  readAt: string | null;
  expiresAt: string | null;
  dedupKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SofliaLearningNotificationPreference {
  preferenceId: string;
  userId: string;
  notificationType: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  emailFrequency: string | null;
  timezone: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SofliaLearningChannelDelivery {
  deliveryId: string;
  notificationId: string;
  userId: string;
  organizationId: string | null;
  channel: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | string;
  destination: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  sentAt: string | null;
  providerMessageId: string | null;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ListUserNotificationsInput {
  userId: string;
  organizationId?: string;
  status?: SofliaLearningNotificationStatus;
  limit?: number;
}

export interface ListNotificationPreferencesInput {
  userId: string;
  notificationType?: string;
  limit?: number;
}

export interface ListPendingDeliveriesInput {
  organizationId?: string;
  channels?: string[];
  limit?: number;
  nowIso?: string;
}

export interface MarkDeliverySentInput {
  deliveryId: string;
  providerMessageId?: string | null;
  sentAtIso?: string;
}

export interface MarkDeliveryFailedInput {
  deliveryId: string;
  error: string;
  nextAttemptAtIso?: string | null;
}

export interface SofliaLearningStatus {
  configured: boolean;
  source: SofliaLearningConfigSource;
  keyKind: SofliaLearningKeyKind | null;
  projectRef: string | null;
  ready: boolean;
  error: string | null;
}
