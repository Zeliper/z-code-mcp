import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  // Claude CLI settings
  claude: z.object({
    command: z.string().default('claude'),
    defaultTimeout: z.number().default(120000),
    defaultMaxTokens: z.number().default(50000)
  }).default({}),

  // Process management
  processes: z.object({
    maxConcurrent: z.number().min(1).max(10).default(3),
    poolStrategy: z.enum(['fifo', 'priority']).default('fifo')
  }).default({}),

  // Temp file settings
  tempFiles: z.object({
    baseDir: z.string().optional(),
    keepOnError: z.boolean().default(false),
    progressUpdateIntervalMs: z.number().default(1000)
  }).default({}),

  // Template settings
  templates: z.object({
    customDir: z.string().optional(),
    allowCustomTemplates: z.boolean().default(true)
  }).default({}),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['text', 'json']).default('text')
  }).default({})
});

export type Config = z.infer<typeof ConfigSchema>;
