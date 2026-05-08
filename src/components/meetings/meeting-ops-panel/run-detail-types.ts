import type { useMeetingOpsState } from './useMeetingOpsState';

export type MeetingOpsState = ReturnType<typeof useMeetingOpsState>;
export type RunDetail = NonNullable<MeetingOpsState['detail']>;
export type CurrentAnalysis = NonNullable<MeetingOpsState['currentAnalysis']>;

export interface FormClassNames {
  inputClass: string;
  selectClass: string;
}
