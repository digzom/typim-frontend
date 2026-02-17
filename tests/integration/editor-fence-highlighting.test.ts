import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { LanguageSupport } from '@codemirror/language';
import { describe, expect, it, vi } from 'vitest';
import { createMarkdownExtension } from '../../src/editor/cm6/extensions/markdown';
import { createCm6FenceLanguageRegistry } from '../../src/editor/cm6/extensions/fence-language-registry';

describe('editor fenced highlighting integration', () => {
  it('AT-FAIL-001: loader rejection falls back safely and editor remains interactive', async () => {
    const rejectingLoader = vi.fn(async (): Promise<LanguageSupport> => {
      throw new Error('injected-failure');
    });

    const registry = createCm6FenceLanguageRegistry({
      loaders: {
        python: rejectingLoader,
      },
    });

    const failedResolution = await registry.resolveFenceLanguage({ fenceName: 'python' });
    expect(failedResolution.languageId).toBe('python');
    expect(failedResolution.loadState).toBe('fallback');
    expect(failedResolution.support).toBeNull();

    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const doc = ['```python', 'print("ok")', '```'].join('\n');

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [
          createMarkdownExtension({
            enableFenceHighlighting: true,
            registry,
          }),
        ],
      }),
    });

    expect(view.state.doc.toString()).toBe(doc);
    expect(() => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\n# still-editable' } });
    }).not.toThrow();
    expect(view.state.doc.toString()).toContain('# still-editable');
    expect(rejectingLoader).toHaveBeenCalledTimes(1);

    view.destroy();
    parent.remove();
  });
});
