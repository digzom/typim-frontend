import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { createMarkdownExtension } from '../../../../src/editor/cm6/extensions/markdown';
import { createCm6FenceLanguageRegistry } from '../../../../src/editor/cm6/extensions/fence-language-registry';

function createView(doc: string, enableFenceHighlighting: boolean): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);

  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        createMarkdownExtension({
          enableFenceHighlighting,
          registry: enableFenceHighlighting ? createCm6FenceLanguageRegistry() : undefined,
        }),
      ],
    }),
  });
}

describe('createMarkdownExtension fenced highlighting integration', () => {
  it('keeps default invocation valid', () => {
    expect(() => createMarkdownExtension()).not.toThrow();
  });

  it('parses unknown fences as plaintext without changing document text', () => {
    const source = ['```unknown', 'raw tokens *stay* plain', '```'].join('\n');

    const view = createView(source, true);

    expect(() => {
      const line = view.state.doc.line(2);
      view.dispatch({ selection: { anchor: line.from + 2 } });
    }).not.toThrow();
    expect(view.state.doc.toString()).toBe(source);

    view.destroy();
    view.dom.parentElement?.remove();
  });
});
