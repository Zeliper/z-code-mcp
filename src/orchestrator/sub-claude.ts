import { spawn, ChildProcess } from 'child_process';
import { PlannedTask, TaskResult, TaskType } from '../types/orchestration.js';
import { ClaudeProcess, ProcessStatus, StreamJsonMessage } from '../types/claude-process.js';
import { TemplateManager, SubTemplate } from '../templates/index.js';
import { TempFileManager } from '../temp-files/manager.js';
import { ProgressTracker } from '../temp-files/progress-tracker.js';
import { ProcessPool } from './process-pool.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ProcessTimeoutError, ProcessSpawnError } from '../utils/errors.js';

interface SubClaudeManagerConfig {
  maxConcurrent: number;
  tempDir: string;
  templateManager: TemplateManager;
  resourceLimits?: {
    totalMaxTokens: number;
    totalMaxMemoryMB: number;
    globalTimeout: number;
  };
}

export class SubClaudeManager {
  private config: SubClaudeManagerConfig;
  private processPool: ProcessPool;
  private activeProcesses: Map<string, ClaudeProcess> = new Map();
  private tempFileManager: TempFileManager;
  private progressTracker: ProgressTracker;

  constructor(config: SubClaudeManagerConfig) {
    this.config = config;
    this.processPool = new ProcessPool(config.maxConcurrent);
    this.tempFileManager = new TempFileManager();
    this.progressTracker = new ProgressTracker(
      this.tempFileManager,
      config.tempDir,
      getConfig().tempFiles.progressUpdateIntervalMs
    );
  }

  async executeAll(tasks: PlannedTask[], workingDirectory: string): Promise<TaskResult[]> {
    const taskPromises = tasks.map((task) =>
      this.processPool.submit(() => this.executeTask(task, workingDirectory))
    );

    const settledResults = await Promise.allSettled(taskPromises);
    const results: TaskResult[] = [];

    for (let i = 0; i < settledResults.length; i++) {
      const result = settledResults[i];
      const task = tasks[i];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          taskId: task.id,
          type: task.type as TaskType,
          status: 'failed',
          output: '',
          tempFilePath: '',
          tokensUsed: 0,
          executionTimeMs: 0,
          error: result.reason?.message ?? 'Unknown error'
        });
      }
    }

    return results;
  }

  private async executeTask(task: PlannedTask, workingDirectory: string): Promise<TaskResult> {
    const startTime = Date.now();
    const tempFilePath = `${this.config.tempDir}\\sub-${task.id}-output.json`;

    // Load template
    const template = await this.config.templateManager.loadTemplate(
      task.assignedTemplate ?? task.type
    );

    const prompt = this.buildTaskPrompt(task, template);
    const fullPrompt = `${template.systemPrompt}\n\n${prompt}`;

    logger.info(`Starting SUB task: ${task.id}`, { type: task.type });

    try {
      const output = await this.spawnSubProcess({
        taskId: task.id,
        workingDirectory,
        prompt: fullPrompt,
        timeout: task.timeout,
        tempFilePath,
        allowedTools: template.allowedTools
      });

      // Write output to temp file
      await this.tempFileManager.writeTaskOutput(this.config.tempDir, task.id, {
        taskId: task.id,
        type: task.type,
        output: output.content,
        tokensUsed: output.tokensUsed,
        timestamp: new Date().toISOString()
      });

      await this.progressTracker.markCompleted(task.id);

      logger.info(`Completed SUB task: ${task.id}`, {
        executionTimeMs: Date.now() - startTime,
        tokensUsed: output.tokensUsed
      });

      return {
        taskId: task.id,
        type: task.type as TaskType,
        status: 'completed',
        output: output.content,
        tempFilePath,
        tokensUsed: output.tokensUsed ?? 0,
        executionTimeMs: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof ProcessTimeoutError;

      await this.progressTracker.markFailed(task.id);

      logger.error(`Failed SUB task: ${task.id}`, { error: errorMessage });

      return {
        taskId: task.id,
        type: task.type as TaskType,
        status: isTimeout ? 'timeout' : 'failed',
        output: '',
        tempFilePath,
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  private async spawnSubProcess(config: {
    taskId: string;
    workingDirectory: string;
    prompt: string;
    timeout: number;
    tempFilePath: string;
    allowedTools: string[];
  }): Promise<{ content: string; tokensUsed?: number }> {
    return new Promise((resolve, reject) => {
      const claudeConfig = getConfig().claude;

      // Build command arguments for Windows
      const args = [
        '/c',
        claudeConfig.command,
        '-p',
        config.prompt,
        '--output-format',
        'stream-json'
      ];

      if (config.allowedTools.length > 0) {
        args.push('--allowedTools', config.allowedTools.join(','));
      }

      let process: ChildProcess;

      try {
        process = spawn('cmd.exe', args, {
          cwd: config.workingDirectory,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (error) {
        reject(new ProcessSpawnError(config.taskId, error instanceof Error ? error.message : String(error)));
        return;
      }

      // Track the process
      const claudeProcess: ClaudeProcess = {
        id: config.taskId,
        process,
        config: {
          workingDirectory: config.workingDirectory,
          prompt: config.prompt,
          outputFormat: 'stream-json',
          timeout: config.timeout
        },
        status: 'running' as ProcessStatus,
        startTime: Date.now(),
        outputBuffer: [],
        tempFilePath: config.tempFilePath
      };

      this.activeProcesses.set(config.taskId, claudeProcess);

      let outputContent = '';
      let tokensUsed = 0;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        process.kill('SIGTERM');
        claudeProcess.status = 'timeout';
        this.activeProcesses.delete(config.taskId);
        reject(new ProcessTimeoutError(config.taskId, config.timeout));
      }, config.timeout);

      // Create throttled progress updater
      const updateProgress = this.progressTracker.createThrottledUpdater(config.taskId);

      process.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const message: StreamJsonMessage = JSON.parse(line);

            if (message.type === 'assistant' && message.content) {
              outputContent += message.content;
            }

            if (message.type === 'result' && message.stats) {
              tokensUsed = message.stats.tokens_used ?? 0;
            }
          } catch {
            // Non-JSON output, append directly
            outputContent += line + '\n';
          }

          claudeProcess.outputBuffer.push(line);
        }

        // Update progress
        updateProgress(lines).catch(() => {
          // Ignore progress update errors
        });
      });

      process.stderr?.on('data', (data: Buffer) => {
        logger.debug(`SUB ${config.taskId} stderr: ${data.toString()}`);
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(config.taskId);

        if (code === 0) {
          claudeProcess.status = 'completed';
          resolve({ content: outputContent, tokensUsed });
        } else {
          claudeProcess.status = 'failed';
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(config.taskId);
        claudeProcess.status = 'failed';
        reject(new ProcessSpawnError(config.taskId, error.message));
      });
    });
  }

  private buildTaskPrompt(task: PlannedTask, template: SubTemplate): string {
    let prompt = `# Task\n\n${task.description}\n\n`;

    if (task.context) {
      prompt += `## Context\n\n${task.context}\n\n`;
    }

    if (task.contextEnhancement) {
      prompt += `## Additional Context\n\n${task.contextEnhancement}\n\n`;
    }

    if (task.targetFiles?.length) {
      prompt += `## Target Files\n\n${task.targetFiles.map((f) => `- ${f}`).join('\n')}\n\n`;
    }

    prompt += `## Output Requirements\n\n`;
    prompt += template.outputFormat.sections.map((s) => `- ${s}`).join('\n');

    return prompt;
  }

  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  getPeakConcurrency(): number {
    return this.processPool.getPeakConcurrency();
  }
}
