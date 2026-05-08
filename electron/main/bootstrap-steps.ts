export type BootstrapStep<T> = () => Promise<T> | T;

export function logBootstrapError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[BOOT] ${context} failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return;
  }

  console.error(`[BOOT] ${context} failed:`, error);
}

export async function runOptionalStep<T>(
  name: string,
  step: BootstrapStep<T>,
): Promise<T | undefined> {
  try {
    return await step();
  } catch (error) {
    logBootstrapError(name, error);
    return undefined;
  }
}
