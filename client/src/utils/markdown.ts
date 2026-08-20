import { marked } from 'marked';

// Configure marked for GitHub Flavored Markdown tables and breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Parses markdown text into HTML with support for GFM tables, code blocks, etc.
 */
export function renderMarkdown(content?: string | null): string {
  if (!content) return '';
  try {
    return marked.parse(content, { async: false }) as string;
  } catch {
    return content;
  }
}
