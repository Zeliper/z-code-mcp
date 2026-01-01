// Re-export result types from orchestration
export type { TaskResult, ExecutionMetrics, OrchestrationResult, OrchestrationError } from './orchestration.js';

// Progress info for temp file tracking
export interface ProgressInfo {
  taskId: string;
  linesProcessed: number;
  lastUpdate: string;
  preview: string[];
  status: 'running' | 'completed' | 'failed';
}

// Aggregated result format
export interface AggregatedResult {
  sections: ResultSection[];
  summary: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
}

// Individual section in aggregated result
export interface ResultSection {
  taskId: string;
  taskType: string;
  title: string;
  content: string;
  status: 'success' | 'failure';
}
