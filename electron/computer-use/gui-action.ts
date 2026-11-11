import os from 'node:os';
import { parseGuiInput } from './gui/input';
import { buildGuiCommand } from './gui/backends';
import { runGuiCommand } from './gui/process';
import type { ComputerExecutionGuard } from './gui/execution-context';

/** Fachada conservada: datos validados, backend explícito y proceso sin shell. */
export async function performGuiAction(action: string, coordinate?: number[], text?: string, guard?: ComputerExecutionGuard): Promise<void> {
  const input = parseGuiInput({ action, coordinate, text });
  await runGuiCommand(buildGuiCommand(input, os.platform()), guard);
}
