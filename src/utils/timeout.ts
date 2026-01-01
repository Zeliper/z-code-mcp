// Timeout wrapper for promises
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage ?? `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Cancellation token
export class CancellationToken {
  private _isCancelled = false;
  private _reason?: string;
  private _callbacks: Array<(reason?: string) => void> = [];

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  get reason(): string | undefined {
    return this._reason;
  }

  cancel(reason?: string): void {
    if (!this._isCancelled) {
      this._isCancelled = true;
      this._reason = reason;
      this._callbacks.forEach((cb) => cb(reason));
    }
  }

  onCancel(callback: (reason?: string) => void): void {
    if (this._isCancelled) {
      callback(this._reason);
    } else {
      this._callbacks.push(callback);
    }
  }

  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new Error(`Operation cancelled: ${this._reason ?? 'No reason provided'}`);
    }
  }
}

// Delay utility
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  }
): Promise<T> {
  let lastError: Error | undefined;
  let currentDelay = options.initialDelayMs;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.maxRetries) {
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * options.backoffMultiplier, options.maxDelayMs);
      }
    }
  }

  throw lastError;
}
