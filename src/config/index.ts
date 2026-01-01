import { Config, ConfigSchema } from './schema.js';

// Default configuration
const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

// Global configuration instance
let globalConfig: Config = DEFAULT_CONFIG;

// Load configuration from environment
export function loadConfig(): Config {
  // Build raw config object from environment variables
  const rawConfig: Record<string, unknown> = {};

  // Claude settings
  if (process.env.Z_MCP_CLAUDE_COMMAND) {
    rawConfig.claude = { command: process.env.Z_MCP_CLAUDE_COMMAND };
  }

  // Process settings
  if (process.env.Z_MCP_MAX_CONCURRENT) {
    const maxConcurrent = parseInt(process.env.Z_MCP_MAX_CONCURRENT, 10);
    if (!isNaN(maxConcurrent)) {
      rawConfig.processes = { maxConcurrent };
    }
  }

  // Temp file settings
  const tempFilesConfig: Record<string, unknown> = {};
  if (process.env.Z_MCP_TEMP_DIR) {
    tempFilesConfig.baseDir = process.env.Z_MCP_TEMP_DIR;
  }
  if (process.env.Z_MCP_KEEP_TEMP === 'true') {
    tempFilesConfig.keepOnError = true;
  }
  if (Object.keys(tempFilesConfig).length > 0) {
    rawConfig.tempFiles = tempFilesConfig;
  }

  // Template settings
  if (process.env.Z_MCP_TEMPLATE_DIR) {
    rawConfig.templates = { customDir: process.env.Z_MCP_TEMPLATE_DIR };
  }

  // Logging settings
  if (process.env.Z_MCP_LOG_LEVEL) {
    rawConfig.logging = { level: process.env.Z_MCP_LOG_LEVEL };
  }

  // Parse and validate with Zod (applies defaults)
  globalConfig = ConfigSchema.parse(rawConfig);
  return globalConfig;
}

// Get current configuration
export function getConfig(): Config {
  return globalConfig;
}

// Update configuration
export function updateConfig(partial: Record<string, unknown>): Config {
  const merged = {
    claude: { ...globalConfig.claude, ...(partial.claude as object) },
    processes: { ...globalConfig.processes, ...(partial.processes as object) },
    tempFiles: { ...globalConfig.tempFiles, ...(partial.tempFiles as object) },
    templates: { ...globalConfig.templates, ...(partial.templates as object) },
    logging: { ...globalConfig.logging, ...(partial.logging as object) }
  };
  globalConfig = ConfigSchema.parse(merged);
  return globalConfig;
}

export { Config, ConfigSchema };
