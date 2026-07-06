export { createInputDriver, type CreateInputDriverDeps, type InputBackendKind } from './input-driver';
export { createLegacyInputDriver } from './legacy-backend';
export { createNutInputDriver, loadNutModule } from './nut-backend';
export { buildHumanPath, motionDurationMs, distance, type PathWaypoint, type HumanPathOptions } from './human-motion';
export type {
  InputDriver,
  InputDriverCapabilities,
  MouseButton,
  MoveOptions,
  PhysicalPoint,
  TypeOptions,
} from './types';
