export type DesktopAction =
  | 'click' | 'double_click' | 'right_click'
  | 'drag' | 'mouse_down' | 'mouse_up' | 'mouse_move'
  | 'type' | 'key' | 'scroll'
  | 'wait' | 'wait_for_change' | 'wait_for_window'
  | 'focus_window' | 'minimize_window' | 'maximize_window'
  | 'restore_window' | 'close_window'
  | 'zoom' | 'click_element' | 'type_in_element'
  | 'done' | 'fail';

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
  message: string;
  subGoal?: string;
  confidence?: number;
  zoomX?: number;
  zoomY?: number;
  zoomRadius?: number;
  elementId?: number;
}

export interface ActionHistoryEntry {
  step: number;
  action: DesktopActionPayload;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  screenshotHash?: string;
  wasRecovery?: boolean;
  verificationFailed?: boolean;
}
