import type { GuidanceControl, GuidanceRequest, GuidanceResult, GuidanceState, PracticeDefinition } from '../shared/orb-guidance';

export interface OrbGuidanceBridge {
  getState(): Promise<GuidanceResult>;
  showTarget(request: GuidanceRequest): Promise<GuidanceResult>;
  control(control: GuidanceControl): Promise<GuidanceResult>;
  startPractice(definition: PracticeDefinition): Promise<GuidanceResult>;
  checkPractice(): Promise<GuidanceResult>;
  onState(callback: (state: GuidanceState) => void): () => void;
}
declare global { interface Window { orbGuidance?: OrbGuidanceBridge } }

function api(): OrbGuidanceBridge {
  if (!window.orbGuidance) throw new Error('La asistencia de escritorio no está disponible.');
  return window.orbGuidance;
}
export const orbGuidanceService = {
  available: () => Boolean(window.orbGuidance),
  getState: () => api().getState(),
  showTarget: (request: GuidanceRequest) => api().showTarget(request),
  control: (control: GuidanceControl) => api().control(control),
  startPractice: (definition: PracticeDefinition) => api().startPractice(definition),
  checkPractice: () => api().checkPractice(),
  onState: (callback: (state: GuidanceState) => void) => api().onState(callback),
};
