import { v4 as uuidv4 } from 'uuid';
import { HeadClaude } from './head-claude.js';
import { SubClaudeManager } from './sub-claude.js';
import { TempFileManager } from '../temp-files/manager.js';
import { ResultAggregator } from '../temp-files/result-aggregator.js';
import { TemplateManager } from '../templates/index.js';
import {
  OrchestrationRequest,
  OrchestrationResult,
  ExecutionMetrics,
  TaskResult
} from '../types/orchestration.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class Orchestrator {
  private templateManager: TemplateManager;
  private tempFileManager: TempFileManager;

  constructor() {
    this.templateManager = new TemplateManager();
    this.tempFileManager = new TempFileManager();
  }

  async execute(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();

    logger.info(`Starting orchestration session: ${sessionId}`, {
      objective: request.objective,
      taskCount: request.tasks.length
    });

    // Initialize temp directory for this session
    const sessionTempDir = await this.tempFileManager.createSessionDir(sessionId);

    try {
      // Phase 1: HEAD analyzes and plans
      const headClaude = new HeadClaude({
        workingDirectory: request.workingDirectory,
        objective: request.objective,
        tasks: request.tasks,
        tempDir: sessionTempDir
      });

      const executionPlan = await headClaude.createExecutionPlan();

      logger.info(`Execution plan created`, {
        taskCount: executionPlan.tasks.length,
        parallelGroups: executionPlan.executionOrder.length
      });

      // Phase 2: Spawn and manage SUB processes
      const subManager = new SubClaudeManager({
        maxConcurrent: request.coordination?.maxConcurrent ?? 3,
        tempDir: sessionTempDir,
        templateManager: this.templateManager,
        resourceLimits: request.resourceLimits
      });

      const taskResults = await subManager.executeAll(
        executionPlan.tasks,
        request.workingDirectory
      );

      // Phase 3: Aggregate results
      const aggregator = new ResultAggregator({
        mode: request.coordination?.aggregationMode ?? 'merge'
      });

      const aggregatedOutput = await aggregator.aggregate(taskResults, sessionTempDir);

      // Phase 4: HEAD summarizes
      const headSummary = await headClaude.summarizeResults(taskResults, aggregatedOutput);

      // Compute metrics
      const metrics = this.computeMetrics(taskResults, startTime, subManager.getPeakConcurrency());

      logger.info(`Orchestration completed: ${sessionId}`, {
        success: true,
        totalTimeMs: metrics.totalExecutionTimeMs,
        tasksCompleted: metrics.tasksCompleted,
        tasksFailed: metrics.tasksFailed
      });

      return {
        success: true,
        sessionId,
        objective: request.objective,
        headSummary,
        taskResults,
        aggregatedOutput,
        metrics
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Orchestration failed: ${sessionId}`, { error: errorMessage });

      return {
        success: false,
        sessionId,
        objective: request.objective,
        headSummary: `Orchestration failed: ${errorMessage}`,
        taskResults: [],
        aggregatedOutput: '',
        metrics: this.computeMetrics([], startTime, 0),
        errors: [
          {
            code: 'ORCHESTRATION_ERROR',
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
          }
        ]
      };
    } finally {
      // Cleanup temp files unless debug mode
      const config = getConfig();
      if (!config.tempFiles.keepOnError) {
        await this.tempFileManager.cleanupSession(sessionId);
      } else {
        logger.debug(`Keeping temp files for session: ${sessionId}`, {
          tempDir: sessionTempDir
        });
      }
    }
  }

  private computeMetrics(
    taskResults: TaskResult[],
    startTime: number,
    peakConcurrency: number
  ): ExecutionMetrics {
    const completed = taskResults.filter((r) => r.status === 'completed');
    const failed = taskResults.filter((r) => r.status !== 'completed');

    return {
      totalExecutionTimeMs: Date.now() - startTime,
      totalTokensUsed: taskResults.reduce((sum, r) => sum + r.tokensUsed, 0),
      tasksCompleted: completed.length,
      tasksFailed: failed.length,
      peakConcurrency
    };
  }
}

export { HeadClaude } from './head-claude.js';
export { SubClaudeManager } from './sub-claude.js';
export { ProcessPool } from './process-pool.js';
