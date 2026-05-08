import {
  startContinuousDesktopObservation,
  stopContinuousDesktopObservation,
} from './observation-control';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentServiceConstructor } from './service-types';

export interface DesktopAgentObservationApi {
  startObservation(objective: string, reactionRules?: string): Promise<void>;
  stopObservation(): void;
}

export function attachDesktopAgentObservation(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    async startObservation(objective: string, reactionRules?: string) {
      this.observationInterval = startContinuousDesktopObservation({
        currentInterval: this.observationInterval,
        stopObservation: () => this.stopObservation(),
        apiKey: this.apiKey,
        objective,
        reactionRules,
        config: this.config,
        ai: this.getGenAI(),
        setStatusObserving: () => { this.status = 'observing'; },
        calculateScreenScale: () => this.calculateScreenScale(),
        isRunning: () => this.observationRunning,
        setRunning: (running) => { this.observationRunning = running; },
        takeScreenshot: () => this.takeScreenshot(),
        quickHash: (base64) => this.quickHash(base64),
        executeAction: (action) => this.executeAction(action),
        emit: (eventName, payload) => { this.emit(eventName, payload); },
      });
    },
    stopObservation() {
      stopContinuousDesktopObservation({
        observationInterval: this.observationInterval,
        setIntervalRef: (interval) => { this.observationInterval = interval; },
        setRunning: (running) => { this.observationRunning = running; },
        setStatusIdle: () => { this.status = 'idle'; },
        emit: (eventName) => { this.emit(eventName); },
      });
    },
  } satisfies DesktopAgentObservationApi & ThisType<DesktopAgentService>);
}
