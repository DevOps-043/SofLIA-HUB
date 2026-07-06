export type DesktopAction =
  | 'click' | 'double_click' | 'right_click'
  | 'drag' | 'mouse_down' | 'mouse_up' | 'mouse_move'
  | 'type' | 'key' | 'scroll'
  | 'wait' | 'wait_for_change' | 'wait_for_window'
  | 'focus_window' | 'minimize_window' | 'maximize_window'
  | 'restore_window' | 'close_window'
  | 'open_application' | 'open_url'
  | 'zoom' | 'click_element' | 'type_in_element'
  | 'click_element_by_name'
  | 'done' | 'fail';

export const DESKTOP_ACTIONS: readonly DesktopAction[] = [
  'click', 'double_click', 'right_click',
  'drag', 'mouse_down', 'mouse_up', 'mouse_move',
  'type', 'key', 'scroll',
  'wait', 'wait_for_change', 'wait_for_window',
  'focus_window', 'minimize_window', 'maximize_window',
  'restore_window', 'close_window',
  'open_application', 'open_url',
  'zoom', 'click_element', 'type_in_element',
  'click_element_by_name',
  'done', 'fail',
] as const;

export function isKnownDesktopAction(value: unknown): value is DesktopAction {
  return typeof value === 'string' && (DESKTOP_ACTIONS as readonly string[]).includes(value);
}

export interface DesktopActionPayload {
  action: DesktopAction;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  windowTitle?: string;
  appName?: string;
  url?: string;
  /** Texto visible del elemento a clickear (click_element_by_name). */
  elementName?: string;
  message: string;
  subGoal?: string;
  confidence?: number;
  zoomX?: number;
  zoomY?: number;
  zoomRadius?: number;
  elementId?: number;
}

export type TargetPoint = { x: number; y: number };
export type TargetRect = { x: number; y: number; width: number; height: number };

export type ResolvedActionTarget = {
  kind: 'text' | 'element' | 'point';
  text?: string;
  source?: 'uia' | 'ocr' | 'visual' | 'coordinate';
  centroFisico?: TargetPoint;
  centroImagen?: TargetPoint;
  bboxFisico?: TargetRect;
  bboxImagen?: TargetRect;
  textScore?: number;
  spatialScore?: number;
  rankingReason?: string;
};

export type FailedActionTargetMemory = ResolvedActionTarget & {
  action: DesktopAction;
  failedAtStep: number;
  expiresAtStep: number;
  reason: string;
};

export type TargetWindowLock = {
  title: string;
  process?: string;
  establishedAtStep: number;
  reason: string;
};

export interface ActionHistoryEntry {
  step: number;
  action: DesktopActionPayload;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  screenshotHash?: string;
  wasRecovery?: boolean;
  verificationFailed?: boolean;
  resolvedTarget?: ResolvedActionTarget;
}
