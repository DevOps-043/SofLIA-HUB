import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';

/**
 * ServiceRegistry implements a robust Service Locator pattern
 * with event-driven notifications for asynchronous service resolution.
 */
export class ServiceRegistry extends EventEmitter {
  private static instance: ServiceRegistry;
  private services: Map<string, any>;
  private factories: Map<string, () => any>;

  private constructor() {
    super();
    this.services = new Map<string, any>();
    this.factories = new Map<string, () => any>();
    
    // Setup generic error catching for the registry's own event emitter
    // to avoid Unhandled 'error' event exceptions crashing the main process.
    this.on('error', (err) => {
      console.error('[ServiceRegistry] Event Emitter error:', err);
    });
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Registers a service instance directly.
   */
  public registerService<T>(name: string, instance: T): void {
    try {
      if (this.services.has(name)) {
        console.warn(`[ServiceRegistry] Warning: Service '${name}' is already registered. Overwriting.`);
      }
      this.services.set(name, instance);
      console.log(`[ServiceRegistry] Service '${name}' registered successfully.`);
      
      this.emit(`registered:${name}`, instance);
      this.emit('registered', name);
    } catch (error) {
      console.error(`[ServiceRegistry] Failed to register service '${name}':`, error);
      // Strict error handling: Do not crash, but emit error.
      this.emit('error', error);
    }
  }

  /**
   * Registers a factory function that will create the service on demand.
   */
  public registerFactory<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
    console.log(`[ServiceRegistry] Factory for service '${name}' registered.`);
  }

  /**
   * Retrieves a service synchronously. 
   * If not instantiated but a factory exists, it creates it.
   */
  public getService<T>(name: string): T {
    try {
      if (this.services.has(name)) {
        return this.services.get(name) as T;
      }

      if (this.factories.has(name)) {
        console.log(`[ServiceRegistry] Instantiating service '${name}' from factory.`);
        const factory = this.factories.get(name)!;
        const instance = factory();
        this.services.set(name, instance);
        this.emit(`registered:${name}`, instance);
        return instance as T;
      }

      throw new Error(`Service '${name}' not found and no factory is registered.`);
    } catch (error) {
      console.error(`[ServiceRegistry] Error retrieving service '${name}':`, error);
      throw error;
    }
  }

  /**
   * Waits for a service to be registered asynchronously.
   * Useful when services have different initialization times.
   */
  public waitForService<T>(name: string, timeoutMs: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.hasService(name)) {
        return resolve(this.getService<T>(name));
      }

      const timeoutId = setTimeout(() => {
        this.removeListener(`registered:${name}`, onRegistered);
        reject(new Error(`[ServiceRegistry] Timeout waiting for service '${name}'`));
      }, timeoutMs);

      const onRegistered = (instance: T) => {
        clearTimeout(timeoutId);
        resolve(instance);
      };

      this.once(`registered:${name}`, onRegistered);
    });
  }

  public hasService(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  public unregisterService(name: string): void {
    if (this.services.has(name)) {
      this.services.delete(name);
      console.log(`[ServiceRegistry] Service '${name}' unregistered.`);
    }
    if (this.factories.has(name)) {
      this.factories.delete(name);
      console.log(`[ServiceRegistry] Factory for '${name}' unregistered.`);
    }
  }

  public clear(): void {
    this.services.clear();
    this.factories.clear();
    this.removeAllListeners();
    console.log(`[ServiceRegistry] All services and factories cleared.`);
  }
}

export interface WorkerDispatchOptions {
  timeoutMs?: number;
  workerPath?: string;
  /** If true, passes taskName and payload to worker via workerData on initialization */
  useWorkerData?: boolean;
}

export interface WorkerTaskPayload {
  taskName: string;
  payload: any;
}

/**
 * WorkerBridge handles dynamic instantiation of Node.js worker_threads
 * to offload CPU-intensive tasks from the Electron Main Thread.
 */
export class WorkerBridge {
  private static instance: WorkerBridge;
  private defaultWorkerPath: string;
  private activeWorkers: Set<Worker>;

  private constructor() {
    // Base path fallback. This may need to be adjusted depending on the bundler configuration (e.g., Vite/Webpack).
    this.defaultWorkerPath = path.join(__dirname, 'worker.js');
    this.activeWorkers = new Set<Worker>();
  }

  public static getInstance(): WorkerBridge {
    if (!WorkerBridge.instance) {
      WorkerBridge.instance = new WorkerBridge();
    }
    return WorkerBridge.instance;
  }

  public setDefaultWorkerPath(absolutePath: string): void {
    this.defaultWorkerPath = absolutePath;
  }

  /**
   * Dispatches a task to a newly created worker thread.
   * Resolves when the worker emits a 'message', preventing UI blocking.
   */
  public dispatchTask<T = any>(taskName: string, payload: any, options: WorkerDispatchOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const { 
        timeoutMs = 60000, 
        workerPath = this.defaultWorkerPath,
        useWorkerData = true
      } = options;

      let worker: Worker | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      try {
        console.log(`[WorkerBridge] Dispatching task '${taskName}' to worker at ${workerPath}`);
        
        const workerOptions: any = {};
        if (useWorkerData) {
          workerOptions.workerData = { taskName, payload };
        }

        worker = new Worker(workerPath, workerOptions);
        this.activeWorkers.add(worker);

        // Cleanup helper to guarantee no ghost workers or memory leaks
        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          if (worker) {
            this.activeWorkers.delete(worker);
            worker.terminate().catch(err => {
              console.error(`[WorkerBridge] Failed to terminate worker: ${err.message}`);
            });
            worker = null;
          }
        };

        // Timeout handler
        if (timeoutMs > 0) {
          timeoutId = setTimeout(() => {
            console.error(`[WorkerBridge] Task '${taskName}' timed out after ${timeoutMs}ms.`);
            cleanup();
            reject(new Error(`Worker task '${taskName}' timed out.`));
          }, timeoutMs);
        }

        // Standard message response from the worker thread
        worker.on('message', (message: any) => {
          console.log(`[WorkerBridge] Task '${taskName}' completed successfully.`);
          cleanup();
          resolve(message as T);
        });

        worker.on('error', (error: Error) => {
          console.error(`[WorkerBridge] Worker error on task '${taskName}':`, error);
          cleanup();
          reject(error);
        });

        worker.on('exit', (code: number) => {
          if (code !== 0) {
            console.error(`[WorkerBridge] Worker stopped with exit code ${code} for task '${taskName}'`);
            cleanup();
            reject(new Error(`Worker stopped with exit code ${code}`));
          } else {
            console.log(`[WorkerBridge] Worker exited gracefully for task '${taskName}'`);
            cleanup();
            // Resolve undefined if the worker exits successfully without returning a message
            resolve(undefined as any);
          }
        });

        // If we did not use workerData, trigger the task explicitly via postMessage
        if (!useWorkerData) {
          worker.postMessage({ type: 'EXECUTE', taskName, payload });
        }

      } catch (error) {
        console.error(`[WorkerBridge] Exception during worker creation/dispatch for task '${taskName}':`, error);
        if (timeoutId) clearTimeout(timeoutId);
        if (worker) {
          this.activeWorkers.delete(worker);
          try {
            (worker as Worker).terminate();
          } catch (termErr) {
             console.error(`[WorkerBridge] Exception during termination:`, termErr);
          }
        }
        reject(error);
      }
    });
  }

  /**
   * Forcefully terminates all active workers. Useful during application teardown.
   */
  public terminateAll(): void {
    console.log(`[WorkerBridge] Terminating ${this.activeWorkers.size} active workers...`);
    for (const worker of this.activeWorkers) {
      worker.terminate().catch(err => {
         console.error(`[WorkerBridge] Error terminating worker: ${err.message}`);
      });
    }
    this.activeWorkers.clear();
  }
}

// Export global singletons for convenient usage across the Electron Main Process
export const serviceRegistry = ServiceRegistry.getInstance();
export const workerBridge = WorkerBridge.getInstance();
