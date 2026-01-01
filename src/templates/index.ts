import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SubTemplate } from './types.js';
import { parseMarkdownTemplate } from './parser.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class TemplateManager {
  private templateDir: string;
  private cache: Map<string, SubTemplate> = new Map();

  constructor(templateDir?: string) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.templateDir = templateDir ?? path.resolve(__dirname, '../../templates');
  }

  async loadTemplate(name: string): Promise<SubTemplate> {
    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Try custom template directory first
    const config = getConfig();
    if (config.templates.customDir) {
      try {
        const customPath = path.join(config.templates.customDir, `${name}.md`);
        const content = await fs.readFile(customPath, 'utf-8');
        const parsed = parseMarkdownTemplate(content);
        this.cache.set(name, parsed.content);
        logger.debug(`Loaded custom template: ${name}`);
        return parsed.content;
      } catch {
        // Fall through to default templates
      }
    }

    // Try default template directory
    try {
      const filePath = path.join(this.templateDir, `${name}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = parseMarkdownTemplate(content);
      this.cache.set(name, parsed.content);
      logger.debug(`Loaded template: ${name}`);
      return parsed.content;
    } catch {
      // Return default template if not found
      logger.debug(`Template not found, using default: ${name}`);
      return this.getDefaultTemplate(name);
    }
  }

  private getDefaultTemplate(name: string): SubTemplate {
    return {
      name,
      type: name,
      description: `Default template for ${name} tasks`,
      systemPrompt: `You are a specialized Claude Code worker focused on ${name} tasks.
Complete the assigned task thoroughly and output results in the specified format.
Be concise but comprehensive. Focus on actionable outputs.`,
      capabilities: ['read', 'analyze', 'output'],
      constraints: ['Stay focused on the assigned task', 'Follow output format'],
      outputFormat: {
        sections: ['Summary', 'Details', 'Recommendations'],
        requiredFields: ['summary'],
        format: 'markdown'
      },
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash']
    };
  }

  async listTemplates(): Promise<string[]> {
    const templates: Set<string> = new Set();

    // List from default directory
    try {
      const files = await fs.readdir(this.templateDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          templates.add(file.replace('.md', ''));
        }
      }
    } catch {
      // Directory may not exist
    }

    // List from custom directory
    const config = getConfig();
    if (config.templates.customDir) {
      try {
        const files = await fs.readdir(config.templates.customDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            templates.add(file.replace('.md', ''));
          }
        }
      } catch {
        // Directory may not exist
      }
    }

    return Array.from(templates);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export * from './types.js';
export * from './parser.js';
