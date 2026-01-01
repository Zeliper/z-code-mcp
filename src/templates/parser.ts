import { ParsedTemplate, SubTemplate, TemplateMetadata, OutputFormatSpec } from './types.js';
import { ParseError } from '../utils/errors.js';

// Parse YAML-like frontmatter
function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { metadata: {}, body: content };
  }

  const metadata: Record<string, string> = {};
  const frontmatterLines = frontmatterMatch[1].split('\n');

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      metadata[key] = value;
    }
  }

  return { metadata, body: frontmatterMatch[2] };
}

// Extract section content by heading
function extractSection(content: string, heading: string): string {
  const headingPattern = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
  const match = content.match(headingPattern);

  if (!match || match.index === undefined) {
    return '';
  }

  const startIndex = match.index + match[0].length;
  const nextHeadingMatch = content.substring(startIndex).match(/^##\s+/m);

  const endIndex = nextHeadingMatch?.index !== undefined
    ? startIndex + nextHeadingMatch.index
    : content.length;

  return content.substring(startIndex, endIndex).trim();
}

// Extract list items from a section
function extractListItems(sectionContent: string): string[] {
  const items: string[] = [];
  const lines = sectionContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
  }

  return items;
}

// Parse markdown template
export function parseMarkdownTemplate(content: string): ParsedTemplate {
  try {
    const { metadata, body } = parseFrontmatter(content);

    // Extract template name from first heading
    const nameMatch = body.match(/^#\s+(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : 'Unknown Template';

    // Extract sections
    const systemPrompt = extractSection(body, 'System Prompt');
    const capabilities = extractListItems(extractSection(body, 'Capabilities'));
    const constraints = extractListItems(extractSection(body, 'Constraints'));
    const allowedTools = extractListItems(extractSection(body, 'Allowed Tools'));

    // Parse output format section
    const outputFormatSection = extractSection(body, 'Output Format');
    const outputFormat: OutputFormatSpec = {
      sections: extractListItems(outputFormatSection),
      requiredFields: ['summary'],
      format: 'markdown'
    };

    // Build template metadata
    const templateMetadata: TemplateMetadata = {
      version: metadata.version ?? '1.0',
      type: metadata.type ?? 'custom',
      author: metadata.author,
      lastUpdated: metadata.lastUpdated
    };

    // Build template content
    const templateContent: SubTemplate = {
      name,
      type: templateMetadata.type,
      description: `Template for ${name}`,
      systemPrompt,
      capabilities,
      constraints,
      outputFormat,
      allowedTools
    };

    return {
      metadata: templateMetadata,
      content: templateContent
    };
  } catch (error) {
    throw new ParseError(
      'markdown template',
      error instanceof Error ? error.message : String(error)
    );
  }
}
