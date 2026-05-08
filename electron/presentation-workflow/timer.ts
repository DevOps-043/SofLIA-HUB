export class WorkflowTimer {
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onTimeout: () => void,
    private readonly timeoutMs: number,
  ) {}

  schedule(): void {
    this.clear();
    this.inactivityTimer = setTimeout(this.onTimeout, this.timeoutMs);
  }

  clear(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
  }
}
