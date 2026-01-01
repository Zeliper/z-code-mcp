import { spawn } from 'child_process';
import {
  TaskDefinition,
  TaskResult,
  PlannedTask,
  ExecutionPlan
} from '../types/orchestration.js';
import { ProcessOutput, StreamJsonMessage } from '../types/claude-process.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface HeadClaudeConfig {
  workingDirectory: string;
  objective: string;
  tasks: TaskDefinition[];
  tempDir: string;
}

export class HeadClaude {
  private config: HeadClaudeConfig;

  constructor(config: HeadClaudeConfig) {
    this.config = config;
  }

  async createExecutionPlan(): Promise<ExecutionPlan> {
    const prompt = this.buildPlanningPrompt();

    logger.info('HEAD creating execution plan');

    try {
      const output = await this.runClaudeProcess({
        prompt,
        systemPrompt: this.getHeadSystemPrompt(),
        outputFormat: 'stream-json',
        timeout: 60000
      });

      return this.parsePlanningOutput(output);
    } catch (error) {
      logger.warn('HEAD planning failed, using fallback plan', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback: parallel execution of all tasks with default templates
      return this.createFallbackPlan();
    }
  }

  async summarizeResults(
    taskResults: TaskResult[],
    aggregatedOutput: string
  ): Promise<string> {
    const prompt = this.buildSummaryPrompt(taskResults, aggregatedOutput);

    logger.info('HEAD summarizing results');

    try {
      const output = await this.runClaudeProcess({
        prompt,
        systemPrompt: this.getHeadSystemPrompt(),
        outputFormat: 'stream-json',
        timeout: 60000
      });

      return output.content;
    } catch (error) {
      logger.warn('HEAD summary failed, using basic summary', {
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createBasicSummary(taskResults);
    }
  }

  private async runClaudeProcess(config: {
    prompt: string;
    systemPrompt: string;
    outputFormat: string;
    timeout: number;
  }): Promise<ProcessOutput> {
    return new Promise((resolve, reject) => {
      const claudeConfig = getConfig().claude;
      const fullPrompt = `${config.systemPrompt}\n\n${config.prompt}`;

      const args = [
        '/c',
        claudeConfig.command,
        '-p',
        fullPrompt,
        '--output-format',
        config.outputFormat
      ];

      const process = spawn('cmd.exe', args, {
        cwd: this.config.workingDirectory,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let outputContent = '';

      const timeoutId = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`HEAD process timed out after ${config.timeout}ms`));
      }, config.timeout);

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();

        // Parse stream-json output
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const message: StreamJsonMessage = JSON.parse(line);
            if (message.type === 'assistant' && message.content) {
              outputContent += message.content;
            }
          } catch {
            outputContent += line;
          }
        }
      });

      process.stderr?.on('data', (data: Buffer) => {
        logger.debug(`HEAD stderr: ${data.toString()}`);
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve({
            content: outputContent,
            exitCode: code
          });
        } else {
          reject(new Error(`HEAD process exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private getHeadSystemPrompt(): string {
    return `You are the HEAD coordinator for a multi-agent Claude Code orchestration system.

Your role is to:
1. Analyze the given objective and tasks
2. Create an optimal execution plan
3. Determine dependencies between tasks
4. Assign appropriate templates to each task
5. Summarize results from worker processes

When creating execution plans:
- Identify tasks that can run in parallel
- Consider resource constraints
- Assign the most suitable template type to each task

When summarizing results:
- Focus on whether the objective was achieved
- Highlight key findings and outputs
- Note any failures or issues
- Suggest next steps if applicable

Always respond in the requested format.`;
  }

  private buildPlanningPrompt(): string {
    const tasksJson = JSON.stringify(
      this.config.tasks.map((t) => ({
        id: t.id,
        type: t.type,
        description: t.description,
        targetFiles: t.targetFiles,
        priority: t.priority
      })),
      null,
      2
    );

    return `Analyze the following orchestration request and create an execution plan.

## Objective
${this.config.objective}

## Tasks
${tasksJson}

## Instructions
Create an execution plan that:
1. Identifies task dependencies (which tasks must complete before others)
2. Groups independent tasks for parallel execution
3. Assigns the most appropriate template to each task
4. Adds context enhancement for each task if needed

Respond with a JSON object in this exact format:
\`\`\`json
{
  "tasks": [
    {
      "id": "task-uuid",
      "type": "code_analysis",
      "description": "...",
      "assignedTemplate": "code-analyzer",
      "contextEnhancement": "Additional context for this task"
    }
  ],
  "dependencies": {
    "task-id-2": ["task-id-1"]
  },
  "executionOrder": [["task-1", "task-2"], ["task-3"]]
}
\`\`\`

The executionOrder is an array of arrays, where each inner array contains tasks that can run in parallel.`;
  }

  private buildSummaryPrompt(taskResults: TaskResult[], aggregatedOutput: string): string {
    const resultsJson = JSON.stringify(
      taskResults.map((r) => ({
        id: r.taskId,
        type: r.type,
        status: r.status,
        executionTimeMs: r.executionTimeMs,
        tokensUsed: r.tokensUsed,
        preview: r.output.substring(0, 300)
      })),
      null,
      2
    );

    return `Summarize the results of the orchestration.

## Original Objective
${this.config.objective}

## Task Results
${resultsJson}

## Aggregated Output (truncated)
${aggregatedOutput.substring(0, 5000)}

## Instructions
Provide a concise summary that:
1. States whether the objective was achieved
2. Highlights key findings or outputs from each task
3. Notes any failures or issues encountered
4. Suggests next steps if applicable

Keep the summary focused and actionable.`;
  }

  private parsePlanningOutput(output: ProcessOutput): ExecutionPlan {
    try {
      // Extract JSON from the output
      const jsonMatch = output.content.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : output.content;

      const parsed = JSON.parse(jsonStr);

      // Merge parsed tasks with original task data
      const plannedTasks: PlannedTask[] = this.config.tasks.map((originalTask) => {
        const planData = parsed.tasks?.find((t: { id: string }) => t.id === originalTask.id);

        return {
          ...originalTask,
          assignedTemplate: planData?.assignedTemplate ?? originalTask.type,
          contextEnhancement: planData?.contextEnhancement ?? ''
        };
      });

      return {
        tasks: plannedTasks,
        dependencies: new Map(Object.entries(parsed.dependencies ?? {})),
        executionOrder: parsed.executionOrder ?? [plannedTasks.map((t) => t.id)]
      };
    } catch (error) {
      logger.warn('Failed to parse HEAD planning output', {
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createFallbackPlan();
    }
  }

  private createFallbackPlan(): ExecutionPlan {
    const plannedTasks: PlannedTask[] = this.config.tasks.map((task) => ({
      ...task,
      assignedTemplate: task.type,
      contextEnhancement: ''
    }));

    return {
      tasks: plannedTasks,
      dependencies: new Map(),
      executionOrder: [plannedTasks.map((t) => t.id)]
    };
  }

  private createBasicSummary(taskResults: TaskResult[]): string {
    const completed = taskResults.filter((r) => r.status === 'completed').length;
    const failed = taskResults.filter((r) => r.status !== 'completed').length;

    let summary = `## Orchestration Summary\n\n`;
    summary += `**Objective:** ${this.config.objective}\n\n`;
    summary += `**Results:** ${completed}/${taskResults.length} tasks completed`;

    if (failed > 0) {
      summary += ` (${failed} failed)`;
    }

    summary += `\n\n### Task Status\n\n`;

    for (const result of taskResults) {
      const status = result.status === 'completed' ? '✓' : '✗';
      summary += `- ${status} **${result.taskId}** (${result.type}): ${result.status}\n`;
    }

    return summary;
  }
}
