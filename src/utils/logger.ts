// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
}

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Simple logger for MCP server (writes to stderr to not interfere with stdio transport)
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? 'info',
      prefix: config.prefix ?? '[z-code-mcp]'
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${prefix} [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: object): void {
    if (this.shouldLog('debug')) {
      console.error(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: object): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: object): void {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: object): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  child(prefix: string): Logger {
    return new Logger({
      level: this.config.level,
      prefix: `${this.config.prefix}${prefix}`
    });
  }
}

// Default logger instance
export const logger = new Logger({
  level: (process.env.Z_MCP_LOG_LEVEL as LogLevel) ?? 'info'
});
