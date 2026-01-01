import { TempFileManager } from './manager.js';
import { ProgressInfo } from '../types/results.js';
import { logger } from '../utils/logger.js';

export class ProgressTracker {
  private tempFileManager: TempFileManager;
  private sessionDir: string;
  private progressData: Map<string, ProgressInfo> = new Map();
  private updateIntervalMs: number;

  constructor(tempFileManager: TempFileManager, sessionDir: string, updateIntervalMs: number = 1000) {
    this.tempFileManager = tempFileManager;
    this.sessionDir = sessionDir;
    this.updateIntervalMs = updateIntervalMs;
  }

  async updateProgress(
    taskId: string,
    linesProcessed: number,
    preview: string[],
    status: 'running' | 'completed' | 'failed'
  ): Promise<void> {
    const progress: ProgressInfo = {
      taskId,
      linesProcessed,
      lastUpdate: new Date().toISOString(),
      preview: preview.slice(-5), // Keep last 5 lines
      status
    };

    this.progressData.set(taskId, progress);

    // Write to temp file
    await this.tempFileManager.writeProgress(this.sessionDir, taskId, progress);
  }

  getProgress(taskId: string): ProgressInfo | undefined {
    return this.progressData.get(taskId);
  }

  getAllProgress(): Map<string, ProgressInfo> {
    return new Map(this.progressData);
  }

  async markCompleted(taskId: string): Promise<void> {
    const existing = this.progressData.get(taskId);
    if (existing) {
      await this.updateProgress(taskId, existing.linesProcessed, existing.preview, 'completed');
    }
  }

  async markFailed(taskId: string): Promise<void> {
    const existing = this.progressData.get(taskId);
    if (existing) {
      await this.updateProgress(taskId, existing.linesProcessed, existing.preview, 'failed');
    } else {
      await this.updateProgress(taskId, 0, [], 'failed');
    }
  }

  // Create a throttled update function for a specific task
  createThrottledUpdater(taskId: string): (lines: string[]) => Promise<void> {
    let lastUpdate = 0;
    let pendingLines: string[] = [];

    return async (newLines: string[]) => {
      pendingLines = [...pendingLines, ...newLines];
      const now = Date.now();

      if (now - lastUpdate >= this.updateIntervalMs) {
        lastUpdate = now;
        await this.updateProgress(taskId, pendingLines.length, pendingLines, 'running');
      }
    };
  }
}
