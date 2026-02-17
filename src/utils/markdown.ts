import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

export interface MarkdownSourceAnchor {
  lineStart: number;
  lineEnd: number;
  elementId: string;
}

export interface MarkdownRenderResult {
  html: string;
  anchors: MarkdownSourceAnchor[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createMarkdownRenderer(): MarkdownIt {
  return new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(code, language): string {
      if (language && hljs.getLanguage(language)) {
        try {
          const highlighted = hljs.highlight(code, { language }).value;
          return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
        } catch {
          // Fall through to escaped output.
        }
      }

      return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
    },
  });
}

const markdownRenderer = createMarkdownRenderer();

function isBlockOpenToken(token: {
  nesting: number;
  block: boolean;
  map: [number, number] | null;
}): token is { nesting: number; block: true; map: [number, number] } {
  return token.nesting === 1 && token.block && Array.isArray(token.map);
}

export function renderMarkdownWithSourceMap(source: string): MarkdownRenderResult {
  try {
    const tokens = markdownRenderer.parse(source, {});
    const anchors: MarkdownSourceAnchor[] = [];
    let anchorIndex = 0;

    for (const token of tokens) {
      if (!isBlockOpenToken(token)) {
        continue;
      }

      const [start, end] = token.map;
      const lineStart = start + 1;
      const lineEnd = end;

      if (lineStart <= 0 || lineEnd < lineStart) {
        continue;
      }

      const elementId = `md-src-${String(lineStart)}-${String(lineEnd)}-${String(anchorIndex)}`;
      token.attrSet('id', elementId);
      token.attrSet('data-source-line-start', String(lineStart));
      token.attrSet('data-source-line-end', String(lineEnd));

      anchors.push({ lineStart, lineEnd, elementId });
      anchorIndex += 1;
    }

    return {
      html: markdownRenderer.renderer.render(tokens, markdownRenderer.options, {}),
      anchors,
    };
  } catch {
    return {
      html: markdownRenderer.render(source),
      anchors: [],
    };
  }
}

export function renderMarkdownToHtml(source: string): string {
  return renderMarkdownWithSourceMap(source).html;
}

export function getMarkdownRenderer(): MarkdownIt {
  return markdownRenderer;
}
