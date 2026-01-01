import { z } from 'zod';

// Task type enumeration
export const TaskTypeSchema = z.enum([
  'code_analysis',
  'code_generation',
  'test_writing',
  'documentation',
  'security_review',
  'refactoring',
  'custom'
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

// Individual task definition
export const TaskDefinitionSchema = z.object({
  id: z.string().uuid(),
  type: TaskTypeSchema,
  description: z.string(),
  context: z.string().optional(),
  targetFiles: z.array(z.string()).optional(),
  customTemplate: z.string().optional(),
  priority: z.number().min(1).max(10).default(5),
  timeout: z.number().min(1000).max(600000).default(120000),
  maxTokens: z.number().min(1000).max(100000).default(50000)
});
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;

// Coordination settings
export const CoordinationSchema = z.object({
  strategy: z.enum(['parallel', 'sequential', 'dependency-based']).default('parallel'),
  maxConcurrent: z.number().min(1).max(5).default(3),
  aggregationMode: z.enum(['merge', 'sequential', 'prioritized']).default('merge')
});
export type Coordination = z.infer<typeof CoordinationSchema>;

// Resource limits
export const ResourceLimitsSchema = z.object({
  totalMaxTokens: z.number().default(200000),
  totalMaxMemoryMB: z.number().default(2048),
  globalTimeout: z.number().default(300000)
});
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;

// Main orchestration request schema
export const OrchestrationRequestSchema = z.object({
  objective: z.string().describe('High-level objective for the orchestration'),
  workingDirectory: z.string().describe('Base directory for all operations'),
  tasks: z.array(TaskDefinitionSchema).min(1).max(10),
  coordination: CoordinationSchema.optional(),
  resourceLimits: ResourceLimitsSchema.optional()
});
export type OrchestrationRequest = z.infer<typeof OrchestrationRequestSchema>;

// Task result
export interface TaskResult {
  taskId: string;
  type: TaskType;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  output: string;
  tempFilePath: string;
  tokensUsed: number;
  executionTimeMs: number;
  error?: string;
}

// Execution metrics
export interface ExecutionMetrics {
  totalExecutionTimeMs: number;
  totalTokensUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
  peakConcurrency: number;
}

// Orchestration error
export interface OrchestrationError {
  taskId?: string;
  code: string;
  message: string;
  stack?: string;
}

// Orchestration result
export interface OrchestrationResult {
  success: boolean;
  sessionId: string;
  objective: string;
  headSummary: string;
  taskResults: TaskResult[];
  aggregatedOutput: string;
  metrics: ExecutionMetrics;
  errors?: OrchestrationError[];
}

// Planned task (with template assignment)
export interface PlannedTask extends TaskDefinition {
  assignedTemplate: string;
  contextEnhancement: string;
}

// Execution plan from HEAD
export interface ExecutionPlan {
  tasks: PlannedTask[];
  dependencies: Map<string, string[]>;
  executionOrder: string[][];
}
