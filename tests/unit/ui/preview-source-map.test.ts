import { describe, expect, it } from 'vitest';
import { renderMarkdownWithSourceMap } from '../../../src/utils/markdown';
import { createPreviewRenderer } from '../../../src/ui/preview';

describe('preview source map generation', () => {
  it('builds deterministic anchor ordering from markdown-it token map', () => {
    const markdown = [
      '# Title',
      '',
      '- one',
      '- two',
      '',
      '> quote',
      '',
      '```ts',
      'const x = 1;',
      '```',
    ].join('\n');

    const first = renderMarkdownWithSourceMap(markdown);
    const second = renderMarkdownWithSourceMap(markdown);

    expect(first.anchors).toEqual(second.anchors);
    expect(first.anchors.length).toBeGreaterThan(0);
    expect(
      first.anchors.every(anchor => anchor.lineStart > 0 && anchor.lineEnd >= anchor.lineStart)
    ).toBe(true);
  });

  it('returns empty anchor map when token map is unavailable', () => {
    const preview = document.createElement('article');
    const renderer = createPreviewRenderer(preview, source => ({
      html: `<p>${source}</p>`,
      anchors: [],
    }));

    const map = renderer.render('plain text');

    expect(map.anchors).toEqual([]);
    expect(map.totalLines).toBe(1);
  });

  it('emits anchor metadata with monotonic map versions across renders', () => {
    const preview = document.createElement('article');
    const renderer = createPreviewRenderer(preview, renderMarkdownWithSourceMap);

    const firstMap = renderer.render('# First');
    const secondMap = renderer.render('# Second\n\nBody');

    expect(secondMap.mapVersion).toBeGreaterThan(firstMap.mapVersion);
    expect(secondMap.anchors.length).toBeGreaterThan(0);
  });

  it('keeps render/getSourceMap contract stable for unchanged content', () => {
    const preview = document.createElement('article');
    const renderer = createPreviewRenderer(preview, renderMarkdownWithSourceMap);

    const firstMap = renderer.render('## Stable\n\nBody');
    const cachedMap = renderer.render('## Stable\n\nBody');
    const currentMap = renderer.getSourceMap();

    expect(cachedMap).toBe(firstMap);
    expect(currentMap).toBe(cachedMap);
    expect(currentMap.mapVersion).toBe(firstMap.mapVersion);
  });
});
