import type { DesktopTaskExecutionOptions } from './types';

export type ParallelDesktopTask = DesktopTaskExecutionOptions & {
  task: string;
};

export type ParallelDesktopTaskResult = {
  task: string;
  result: string;
  success: boolean;
};

export async function executeParallelDesktopTasks(
  tasks: ParallelDesktopTask[],
  executeTask: (task: string, options?: DesktopTaskExecutionOptions) => Promise<string>,
): Promise<ParallelDesktopTaskResult[]> {
  const results = await Promise.allSettled(
    tasks.map(({ task, ...options }) => executeTask(task, options)),
  );

  return results.map((result, index) => ({
    task: tasks[index].task,
    result: result.status === 'fulfilled'
      ? result.value
      : result.reason instanceof Error ? result.reason.message : String(result.reason || 'Error desconocido'),
    success: result.status === 'fulfilled',
  }));
}
