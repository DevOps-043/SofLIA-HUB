export interface AlarmConfig {
  defaultSoundDuration: number;
}

export interface AlarmInfo {
  id: string;
  triggerTime: number;
  message: string;
}

export interface AlarmStatus {
  activeAlarms: number;
  alarms: AlarmInfo[];
  isRunning: boolean;
}

export interface AlarmEntry {
  info: AlarmInfo;
  timerId: NodeJS.Timeout;
}
