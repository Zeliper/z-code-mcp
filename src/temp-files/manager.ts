import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class TempFileManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    const config = getConfig();
    this.baseDir = baseDir ?? config.tempFiles.baseDir ?? path.join(os.tmpdir(), 'z-mcp');
  }

  async createSessionDir(sessionId: string): Promise<string> {
    const sessionDir = path.join(this.baseDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    logger.debug(`Created session directory: ${sessionDir}`);
    return sessionDir;
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const sessionDir = path.join(this.baseDir, sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
      logger.debug(`Cleaned up session directory: ${sessionDir}`);
    } catch (error) {
      logger.warn(`Failed to cleanup session directory: ${sessionDir}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async writeTaskOutput(sessionDir: string, taskId: string, data: object): Promise<string> {
    const filePath = path.join(sessionDir, `sub-${taskId}-output.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  async writeProgress(sessionDir: string, taskId: string, progress: object): Promise<string> {
    const filePath = path.join(sessionDir, `sub-${taskId}-output.progress.json`);
    await fs.writeFile(filePath, JSON.stringify(progress, null, 2), 'utf-8');
    return filePath;
  }

  async readTaskOutput(sessionDir: string, taskId: string): Promise<object | null> {
    const filePath = path.join(sessionDir, `sub-${taskId}-output.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async readAllOutputs(sessionDir: string): Promise<Map<string, object>> {
    const results = new Map<string, object>();

    try {
      const files = await fs.readdir(sessionDir);

      for (const file of files) {
        if (file.endsWith('-output.json') && !file.includes('.progress.')) {
          try {
            const content = await fs.readFile(path.join(sessionDir, file), 'utf-8');
            const taskId = file.replace('sub-', '').replace('-output.json', '');
            results.set(taskId, JSON.parse(content));
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory may not exist
    }

    return results;
  }

  async cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    let cleaned = 0;

    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sessionDir = path.join(this.baseDir, entry.name);
          try {
            const stats = await fs.stat(sessionDir);
            if (now - stats.mtimeMs > maxAgeMs) {
              await fs.rm(sessionDir, { recursive: true, force: true });
              cleaned++;
            }
          } catch {
            // Skip inaccessible directories
          }
        }
      }
    } catch {
      // Base directory may not exist
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old session directories`);
    }

    return cleaned;
  }
}
