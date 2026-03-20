/**
 * @file api-rate-limiter.ts
 * @description Provides a generic utility for rate-limiting API requests.
 * This is essential for managing requests to external services like Google Generative AI
 * or Microsoft Graph, which have strict usage limits.
 */

interface RateLimiterOptions {
  /**
   * The maximum number of requests allowed per interval.
   */
  requestsPerInterval: number;
  /**
   * The time interval in milliseconds.
   */
  interval: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

/**
 * A generic utility to limit the rate of API requests.
 * It uses an internal queue to handle requests and respects the configured limits.
 */
export class ApiRateLimiter {
  private readonly queue: QueuedRequest<any>[] = [];
  private readonly requestsPerInterval: number;
  private readonly interval: number;
  private requestsMadeInInterval: number = 0;
  private intervalStartTimestamp: number = 0;
  private isProcessing: boolean = false;

  constructor({ requestsPerInterval, interval }: RateLimiterOptions) {
    this.requestsPerInterval = requestsPerInterval;
    this.interval = interval;
  }

  /**
   * Enqueues an async function to be executed while respecting the rate limit.
   * @param fn The async function that returns a Promise to be executed.
   * @returns A promise that resolves with the result of the function.
   */
  public enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const now = Date.now();

        if (now - this.intervalStartTimestamp >= this.interval) {
          this.intervalStartTimestamp = now;
          this.requestsMadeInInterval = 0;
        }

        if (this.requestsMadeInInterval < this.requestsPerInterval) {
          this.requestsMadeInInterval++;
          const request = this.queue.shift();
          if (request) {
            try {
              const result = await request.fn();
              request.resolve(result);
            } catch (error) {
              request.reject(error);
            }
          }
        } else {
          const timeToWait = this.intervalStartTimestamp + this.interval - now;
          if (timeToWait > 0) {
            await new Promise(resolve => setTimeout(resolve, timeToWait));
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
