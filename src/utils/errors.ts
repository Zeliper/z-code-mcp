// Base orchestration error
export class OrchestrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public taskId?: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'OrchestrationError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      taskId: this.taskId,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }
}

// Process timeout error
export class ProcessTimeoutError extends OrchestrationError {
  constructor(taskId: string, timeout: number) {
    super(
      `Process ${taskId} timed out after ${timeout}ms`,
      'PROCESS_TIMEOUT',
      taskId,
      false
    );
    this.name = 'ProcessTimeoutError';
  }
}

// Process spawn error
export class ProcessSpawnError extends OrchestrationError {
  constructor(taskId: string, reason: string) {
    super(
      `Failed to spawn process for ${taskId}: ${reason}`,
      'PROCESS_SPAWN_ERROR',
      taskId,
      true
    );
    this.name = 'ProcessSpawnError';
  }
}

// Template not found error
export class TemplateNotFoundError extends OrchestrationError {
  constructor(templateName: string) {
    super(
      `Template "${templateName}" not found`,
      'TEMPLATE_NOT_FOUND',
      undefined,
      true
    );
    this.name = 'TemplateNotFoundError';
  }
}

// Resource limit error
export class ResourceLimitError extends OrchestrationError {
  constructor(resource: string, limit: number, current: number) {
    super(
      `Resource limit exceeded: ${resource} (${current}/${limit})`,
      'RESOURCE_LIMIT',
      undefined,
      false
    );
    this.name = 'ResourceLimitError';
  }
}

// Parse error
export class ParseError extends OrchestrationError {
  constructor(context: string, reason: string) {
    super(
      `Failed to parse ${context}: ${reason}`,
      'PARSE_ERROR',
      undefined,
      true
    );
    this.name = 'ParseError';
  }
}
