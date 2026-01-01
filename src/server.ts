import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Orchestrator } from './orchestrator/index.js';
import { OrchestrationRequestSchema } from './types/orchestration.js';
import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';

export async function createServer(): Promise<{ start: () => Promise<void> }> {
  // Load configuration
  loadConfig();

  const server = new McpServer({
    name: 'z-code-mcp',
    version: '1.0.0'
  });

  const orchestrator = new Orchestrator();

  // Register the single "orchestrate" tool
  server.tool(
    'orchestrate',
    'Orchestrate multiple Claude Code sessions with HEAD/SUB coordination. HEAD analyzes the objective, creates an execution plan, spawns SUB processes to handle individual tasks, and aggregates results.',
    {
      objective: z.string().describe('High-level objective for the orchestration'),
      workingDirectory: z.string().describe('Base directory for all operations'),
      tasks: z
        .array(
          z.object({
            id: z.string().uuid().describe('Unique task identifier'),
            type: z
              .enum([
                'code_analysis',
                'code_generation',
                'test_writing',
                'documentation',
                'security_review',
                'refactoring',
                'custom'
              ])
              .describe('Task type for template selection'),
            description: z.string().describe('What this task should accomplish'),
            context: z.string().optional().describe('Additional context for the task'),
            targetFiles: z.array(z.string()).optional().describe('Files to focus on'),
            customTemplate: z.string().optional().describe('Custom template name to use'),
            priority: z.number().min(1).max(10).default(5).describe('Task priority (1-10)'),
            timeout: z
              .number()
              .min(1000)
              .max(600000)
              .default(120000)
              .describe('Task timeout in milliseconds'),
            maxTokens: z
              .number()
              .min(1000)
              .max(100000)
              .default(50000)
              .describe('Maximum tokens for this task')
          })
        )
        .min(1)
        .max(10)
        .describe('List of tasks to execute'),
      coordination: z
        .object({
          strategy: z
            .enum(['parallel', 'sequential', 'dependency-based'])
            .default('parallel')
            .describe('Execution strategy'),
          maxConcurrent: z
            .number()
            .min(1)
            .max(5)
            .default(3)
            .describe('Maximum concurrent SUB processes'),
          aggregationMode: z
            .enum(['merge', 'sequential', 'prioritized'])
            .default('merge')
            .describe('How to aggregate results')
        })
        .optional()
        .describe('Coordination settings'),
      resourceLimits: z
        .object({
          totalMaxTokens: z.number().default(200000).describe('Total token limit'),
          totalMaxMemoryMB: z.number().default(2048).describe('Memory limit in MB'),
          globalTimeout: z.number().default(300000).describe('Global timeout in milliseconds')
        })
        .optional()
        .describe('Resource limits')
    },
    async (request) => {
      try {
        logger.info('Received orchestrate request', {
          objective: request.objective,
          taskCount: request.tasks.length
        });

        // Validate and parse the request
        const validatedRequest = OrchestrationRequestSchema.parse(request);

        // Execute orchestration
        const result = await orchestrator.execute(validatedRequest);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Orchestration request failed', { error: errorMessage });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: errorMessage,
                  stack: error instanceof Error ? error.stack : undefined
                },
                null,
                2
              )
            }
          ],
          isError: true
        };
      }
    }
  );

  return {
    start: async () => {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info('z-code-mcp server started');
    }
  };
}
