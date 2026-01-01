type Task<T> = () => Promise<T>;

interface QueueItem<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class ProcessPool {
  private maxConcurrent: number;
  private running: number = 0;
  private queue: Array<QueueItem<unknown>> = [];
  private peakConcurrency: number = 0;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async submit<T>(task: Task<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject } as QueueItem<unknown>);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.running++;
      this.peakConcurrency = Math.max(this.peakConcurrency, this.running);

      this.executeTask(item);
    }
  }

  private async executeTask<T>(item: QueueItem<T>): Promise<void> {
    try {
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  get activeCount(): number {
    return this.running;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get totalCount(): number {
    return this.running + this.queue.length;
  }

  getPeakConcurrency(): number {
    return this.peakConcurrency;
  }

  resetPeakConcurrency(): void {
    this.peakConcurrency = this.running;
  }
}
