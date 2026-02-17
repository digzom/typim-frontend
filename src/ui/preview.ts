import type { PreviewSourceMap } from '../core/types';
import type { MarkdownRenderResult } from '../utils/markdown';

interface PreviewRenderer {
  render(markdown: string): PreviewSourceMap;
  clear(): void;
  getSourceMap(): PreviewSourceMap;
}

export function createPreviewRenderer(
  element: HTMLElement,
  renderMarkdown: (source: string) => MarkdownRenderResult
): PreviewRenderer {
  let lastContent = '';
  let mapVersion = 0;
  let sourceMap: PreviewSourceMap = {
    anchors: [],
    mapVersion,
    totalLines: 0,
  };

  return {
    render(markdown: string): PreviewSourceMap {
      if (markdown === lastContent) {
        return sourceMap;
      }

      lastContent = markdown;
      const result = renderMarkdown(markdown);
      element.innerHTML = result.html;
      mapVersion += 1;

      sourceMap = {
        anchors: result.anchors.map(anchor => {
          const anchorElement = element.querySelector<HTMLElement>(`#${anchor.elementId}`);
          return {
            lineStart: anchor.lineStart,
            lineEnd: anchor.lineEnd,
            elementId: anchor.elementId,
            offsetTop: anchorElement?.offsetTop ?? 0,
            offsetHeight: anchorElement?.offsetHeight ?? 0,
          };
        }),
        mapVersion,
        totalLines: markdown.length === 0 ? 0 : markdown.split('\n').length,
      };

      return sourceMap;
    },

    clear(): void {
      lastContent = '';
      mapVersion += 1;
      sourceMap = {
        anchors: [],
        mapVersion,
        totalLines: 0,
      };
      element.innerHTML = '';
    },

    getSourceMap(): PreviewSourceMap {
      return sourceMap;
    },
  };
}
