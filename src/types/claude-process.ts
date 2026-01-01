import { ChildProcess } from 'child_process';

// Process status
export type ProcessStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

// Claude process configuration
export interface ClaudeProcessConfig {
  workingDirectory: string;
  prompt: string;
  systemPrompt?: string;
  outputFormat: 'text' | 'json' | 'stream-json';
  allowedTools?: string[];
  timeout: number;
  maxTokens?: number;
}

// Active Claude process
export interface ClaudeProcess {
  id: string;
  process: ChildProcess;
  config: ClaudeProcessConfig;
  status: ProcessStatus;
  startTime: number;
  outputBuffer: string[];
  tempFilePath: string;
}

// Process output
export interface ProcessOutput {
  sessionId?: string;
  content: string;
  tokensUsed?: number;
  exitCode: number | null;
}

// Stream JSON message types from Claude CLI
export interface StreamJsonMessage {
  type: 'init' | 'user' | 'assistant' | 'result' | 'error';
  content?: string;
  session_id?: string;
  stats?: {
    tokens_used: number;
    duration_ms: number;
  };
  error?: string;
}
