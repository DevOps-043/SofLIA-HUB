import {
  startContinuousDesktopObservation,
  stopContinuousDesktopObservation,
} from './observation-control';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentServiceConstructor } from './service-types';
import { getAuthState, onAuthStateChange } from '../main/auth-state';

const generations = new WeakMap<DesktopAgentService, { controller: AbortController; dispose(): void }>();
const physicalCycles = new WeakMap<DesktopAgentService, { busy: boolean }>();

export interface DesktopAgentObservationApi {
  startObservation(objective: string, reactionRules?: string, signal?: AbortSignal): Promise<void>;
  stopObservation(): void;
}

export function attachDesktopAgentObservation(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    async startObservation(objective: string, reactionRules?: string, external?: AbortSignal) {
      this.stopObservation();
      const identity = getAuthState();
      if (!identity.authenticated || !identity.userId || external?.aborted) throw new Error('Observación no autorizada.');
      const controller = new AbortController();
      const stop = () => { if (generations.get(this)?.controller === controller) this.stopObservation(); };
      const unsubscribe = onAuthStateChange(stop);
      external?.addEventListener('abort', stop, { once: true });
      generations.set(this, { controller, dispose: () => { unsubscribe(); external?.removeEventListener('abort', stop); controller.abort(); } });
      const cycle = physicalCycles.get(this) ?? { busy: false }; physicalCycles.set(this, cycle);
      try {
        this.observationInterval = startContinuousDesktopObservation({
          signal: controller.signal,
          onCycleEnd: () => { cycle.busy = false; },
          currentInterval: null,
          stopObservation: () => this.stopObservation(),
          objective,
          reactionRules,
          config: this.config,
          ai: this.getInference(),
          setStatusObserving: () => { this.status = 'observing'; },
          calculateScreenScale: () => this.calculateScreenScale(),
          isRunning: () => cycle.busy,
          setRunning: (running) => { cycle.busy = running; this.observationRunning = running; },
          takeScreenshot: () => this.takeScreenshot(),
          quickHash: (base64) => this.quickHash(base64),
          executeAction: (action) => this.executeAction(action),
          emit: (eventName, payload) => { this.emit(eventName, payload); },
        });
      } catch (error) { stop(); throw error; }
    },
    stopObservation() {
      const previous = generations.get(this); generations.delete(this); previous?.dispose();
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
