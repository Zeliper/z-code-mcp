// Template metadata
export interface TemplateMetadata {
  version: string;
  type: string;
  author?: string;
  lastUpdated?: string;
}

// Output format specification
export interface OutputFormatSpec {
  sections: string[];
  requiredFields: string[];
  format: 'markdown' | 'json' | 'structured';
}

// SUB template definition
export interface SubTemplate {
  name: string;
  type: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  constraints: string[];
  outputFormat: OutputFormatSpec;
  allowedTools: string[];
}

// Parsed template with metadata
export interface ParsedTemplate {
  metadata: TemplateMetadata;
  content: SubTemplate;
}
