/**
 * Command Center Stub
 * Temporary file to prevent build failures from residual imports in main.ts
 * and other electron components.
 */

export class CommandCenter {
  private initialized: boolean = false;
  private running: boolean = false;
  private commands: Map<string, Function> = new Map();

  constructor() {
    // Initialize properties
  }

  /**
   * Initializes the command center
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[CommandCenter] Stub initialized');
  }

  /**
   * Starts the command center services
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    if (this.running) return;
    this.running = true;
    console.log('[CommandCenter] Stub started');
  }

  /**
   * Stops the command center services
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.commands.clear();
    console.log('[CommandCenter] Stub stopped');
  }

  /**
   * Registers a dummy command
   */
  registerCommand(name: string, handler: Function): void {
    this.commands.set(name, handler);
    console.log(`[CommandCenter] Registered command: ${name}`);
  }

  /**
   * Executes a dummy command
   */
  async executeCommand(name: string, ...args: any[]): Promise<any> {
    const handler = this.commands.get(name);
    if (handler) {
      console.log(`[CommandCenter] Executing command: ${name}`);
      return handler(...args);
    }
    console.warn(`[CommandCenter] Command ${name} not found in stub`);
    return null;
  }

  /**
   * Returns whether the service is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Returns a list of available commands
   */
  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}

// Export a singleton instance
export const commandCenter = new CommandCenter();

// Default export as well just in case
export default commandCenter;
