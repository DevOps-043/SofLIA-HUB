const MIN_PLANNED_BUDGET = 15;
const MIN_NATIVE_LAUNCH_BUDGET = 35;
const MIN_INTEGRATED_BROWSER_BUDGET = 90;
const INTEGRATED_BROWSER_HARD_CAP = 120;
const PLAN_BUDGET_MULTIPLIER = 2;

/**
 * Presupuesto de pasos efectivo de una tarea:
 * - Si el llamador pide maxSteps explicito, se respeta acotado al tope duro.
 * - Con plan, se presupuesta el doble de los pasos estimados (minimo 15).
 * - Sin plan, el presupuesto por defecto de config.
 * Evita que una tarea simple queme 200 pasos dando vueltas.
 */
export function resolveTaskStepBudget(params: {
  requestedMaxSteps?: number;
  planEstimatedSteps?: number | null;
  task?: string;
  surface?: 'integrated-browser' | 'other';
  config: { maxSteps: number; defaultStepBudget: number };
}): number {
  // El presupuesto integrado es un contrato del producto y no debe quedar
  // reducido a 60 por un desktop-agent-config.json creado en versiones previas.
  const hardCap = params.surface === 'integrated-browser'
    ? INTEGRATED_BROWSER_HARD_CAP
    : Math.max(1, params.config.maxSteps);
  const browserMinimum = params.surface === 'integrated-browser'
    ? Math.min(MIN_INTEGRATED_BROWSER_BUDGET, hardCap)
    : 1;
  const nativeLaunch = requiresNativeLaunchBudget(params.task);
  const nativeMinimum = nativeLaunch ? Math.min(MIN_NATIVE_LAUNCH_BUDGET, hardCap) : 1;
  const requestedMinBudget = Math.max(browserMinimum, nativeMinimum);
  const plannedMinBudget = Math.max(
    browserMinimum,
    nativeLaunch ? nativeMinimum : Math.min(MIN_PLANNED_BUDGET, hardCap),
  );
  if (params.requestedMaxSteps !== undefined && Number.isFinite(params.requestedMaxSteps)) {
    return clamp(Math.round(params.requestedMaxSteps), requestedMinBudget, hardCap);
  }
  const estimated = params.planEstimatedSteps;
  if (typeof estimated === 'number' && Number.isFinite(estimated) && estimated > 0) {
    return clamp(Math.round(estimated * PLAN_BUDGET_MULTIPLIER), plannedMinBudget, hardCap);
  }
  return clamp(Math.max(1, params.config.defaultStepBudget), plannedMinBudget, hardCap);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function requiresNativeLaunchBudget(task: string | undefined): boolean {
  const lower = (task || '').toLowerCase();
  if (!lower) return false;
  if (/minecraft|launcher|java edition|juego|game/.test(lower)) return true;
  return /(abre|abrir|ejecuta|ejecutar|inicia|iniciar|launch|open).*(excel|word|powerpoint|outlook|paint|notepad|calculadora|calculator|app|aplicacion|programa)/.test(lower);
}
