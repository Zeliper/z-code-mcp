import { TaskResult } from '../types/orchestration.js';
import { AggregatedResult, ResultSection } from '../types/results.js';

interface AggregatorConfig {
  mode: 'merge' | 'sequential' | 'prioritized';
}

export class ResultAggregator {
  private config: AggregatorConfig;

  constructor(config: AggregatorConfig) {
    this.config = config;
  }

  async aggregate(taskResults: TaskResult[], _sessionDir: string): Promise<string> {
    const completedResults = taskResults.filter((r) => r.status === 'completed');
    const failedResults = taskResults.filter((r) => r.status !== 'completed');

    let aggregated: string;

    switch (this.config.mode) {
      case 'merge':
        aggregated = this.mergeResults(completedResults);
        break;
      case 'sequential':
        aggregated = this.sequentialResults(completedResults);
        break;
      case 'prioritized':
        aggregated = this.prioritizedResults(completedResults);
        break;
      default:
        aggregated = this.mergeResults(completedResults);
    }

    // Append failure summary if any
    if (failedResults.length > 0) {
      aggregated += '\n\n---\n\n## Failed Tasks\n\n';
      for (const result of failedResults) {
        aggregated += `- **${result.taskId}** (${result.type}): ${result.error ?? result.status}\n`;
      }
    }

    return aggregated;
  }

  aggregateStructured(taskResults: TaskResult[]): AggregatedResult {
    const sections: ResultSection[] = [];
    let successfulTasks = 0;
    let failedTasks = 0;

    for (const result of taskResults) {
      const isSuccess = result.status === 'completed';

      sections.push({
        taskId: result.taskId,
        taskType: result.type,
        title: this.formatTaskType(result.type),
        content: result.output,
        status: isSuccess ? 'success' : 'failure'
      });

      if (isSuccess) {
        successfulTasks++;
      } else {
        failedTasks++;
      }
    }

    return {
      sections,
      summary: `Completed ${successfulTasks}/${taskResults.length} tasks`,
      totalTasks: taskResults.length,
      successfulTasks,
      failedTasks
    };
  }

  private mergeResults(results: TaskResult[]): string {
    const sections: string[] = [];

    for (const result of results) {
      sections.push(
        `## ${this.formatTaskType(result.type)} (${result.taskId})\n\n${result.output}`
      );
    }

    return sections.join('\n\n---\n\n');
  }

  private sequentialResults(results: TaskResult[]): string {
    // Order by execution time (earliest first)
    const sorted = [...results].sort((a, b) => a.executionTimeMs - b.executionTimeMs);
    return this.mergeResults(sorted);
  }

  private prioritizedResults(results: TaskResult[]): string {
    // Group by importance (code changes > tests > docs > analysis)
    const priorityOrder: Record<string, number> = {
      code_generation: 1,
      refactoring: 2,
      test_writing: 3,
      security_review: 4,
      documentation: 5,
      code_analysis: 6,
      custom: 7
    };

    const sorted = [...results].sort(
      (a, b) => (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99)
    );

    return this.mergeResults(sorted);
  }

  private formatTaskType(type: string): string {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
