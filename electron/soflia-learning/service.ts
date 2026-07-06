import { EventEmitter } from 'node:events';
import { createSofliaLearningClient } from './client';
import { SofliaLearningRepository } from './repository';
import type {
  ListNotificationPreferencesInput,
  ListPendingDeliveriesInput,
  ListUserNotificationsInput,
  MarkDeliveryFailedInput,
  MarkDeliverySentInput,
  SofliaLearningClientResult,
  SofliaLearningRepositoryError,
  SofliaLearningStatus,
} from './types';

export interface SofliaLearningServiceDeps {
  clientFactory?: () => SofliaLearningClientResult;
  repository?: SofliaLearningRepository;
}

export class SofliaLearningService extends EventEmitter {
  private repository: SofliaLearningRepository | null;
  private lastClientResult: SofliaLearningClientResult | null = null;

  constructor(private readonly deps: SofliaLearningServiceDeps = {}) {
    super();
    this.repository = deps.repository || null;
  }

  init(): SofliaLearningStatus {
    this.refreshRepository();
    const status = this.getStatus();
    this.emit('status', status);
    return status;
  }

  getStatus(): SofliaLearningStatus {
    const result = this.lastClientResult;
    if (this.repository && !result) {
      return {
        configured: true,
        source: 'env',
        keyKind: null,
        projectRef: null,
        ready: true,
        error: null,
      };
    }

    const config = result?.config;
    return {
      configured: Boolean(result?.bundle),
      source: config?.source || 'missing',
      keyKind: config?.keyKind || null,
      projectRef: config?.projectRef || null,
      ready: Boolean(this.repository),
      error: result?.error || config?.error || null,
    };
  }

  getNotificationById(notificationId: string) {
    const repository = this.requireRepository();
    if (!repository.ok) {
      return Promise.resolve(repository);
    }
    return repository.data.getNotificationById(notificationId);
  }

  listUserNotifications(input: ListUserNotificationsInput) {
    const repository = this.requireRepository();
    if (!repository.ok) {
      return Promise.resolve(repository);
    }
    return repository.data.listUserNotifications(input);
  }

  listNotificationPreferences(input: ListNotificationPreferencesInput) {
    const repository = this.requireRepository();
    if (!repository.ok) {
      return Promise.resolve(repository);
    }
    return repository.data.listNotificationPreferences(input);
  }

  listPendingChannelDeliveries(input?: ListPendingDeliveriesInput) {
    const repository = this.requireRepository();
    if (!repository.ok) {
      return Promise.resolve(repository);
    }
    return repository.data.listPendingChannelDeliveries(input);
  }

  markChannelDeliverySent(input: MarkDeliverySentInput) {
    const repository = this.requireRepository();
    if (!repository.ok) {
      return Promise.resolve(repository);
    }
    return repository.data.markChannelDeliverySent(input);
  }

  markChannelDeliveryFailed(input: MarkDeliveryFailedInput) {
    const repository = this.requireRepository();
    if (!repository.ok) {
      return Promise.resolve(repository);
    }
    return repository.data.markChannelDeliveryFailed(input);
  }

  private refreshRepository(): void {
    if (this.repository) {
      return;
    }

    const clientResult = this.deps.clientFactory ? this.deps.clientFactory() : createSofliaLearningClient();
    this.lastClientResult = clientResult;
    this.repository = clientResult.bundle ? new SofliaLearningRepository(clientResult.bundle.client) : null;
  }

  private requireRepository() {
    this.refreshRepository();
    if (this.repository) {
      return { ok: true as const, data: this.repository };
    }

    return {
      ok: false as const,
      error: {
        code: 'query_failed' as const,
        message: this.getStatus().error || 'SofLIA Learning no esta configurado.',
      } satisfies SofliaLearningRepositoryError,
    };
  }
}

