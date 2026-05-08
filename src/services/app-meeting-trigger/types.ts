export interface MeetingTriggerHandlingResult {
  kind: 'started' | 'stopped' | 'noop' | 'busy' | 'error';
  message: string;
}
