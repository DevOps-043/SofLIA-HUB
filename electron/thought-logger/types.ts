export interface ThoughtEvent {
  id: number;
  agent_id: string;
  task_id: string;
  thought_data: any;
  status?: string;
  context_dump?: any;
  update_time?: string;
  timestamp: string;
}

export type WorkerRestartCallback = (taskId: string, contextDump: any) => void;
