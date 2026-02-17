import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createMarkdownExtension } from '../../src/editor/cm6/extensions/markdown';
import { createCm6FenceLanguageRegistry } from '../../src/editor/cm6/extensions/fence-language-registry';
import { createSemanticMarkdownVisibilityExtension } from '../../src/editor/cm6/extensions/semantic-markdown';
import { LiveMarkdownEngine } from '../../src/editor/live-markdown/engine';
import { resolveFenceHighlightGate, resolveLiveMarkdownModeGate } from '../../src/main';

function createSemanticEditor(
  source: string,
  options?: {
    isEnabled?: () => boolean;
    isVimEnabled?: () => boolean;
    enableFenceHighlighting?: boolean;
  }
): { parent: HTMLDivElement; view: EditorView } {
  const parent = document.createElement('div');
  document.body.appendChild(parent);

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: source,
      extensions: [
        createMarkdownExtension({
          enableFenceHighlighting: options?.enableFenceHighlighting ?? false,
          registry: options?.enableFenceHighlighting ? createCm6FenceLanguageRegistry() : undefined,
        }),
        createSemanticMarkdownVisibilityExtension({
          isEnabled: options?.isEnabled ?? (() => true),
          isVimEnabled: options?.isVimEnabled ?? (() => false),
        }),
      ],
    }),
  });

  return { parent, view };
}

function delimiterSnapshot(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll('.cm-md-delim-hidden, .cm-md-delim-reveal')).map(
    node => {
      const element = node as HTMLElement;
      const visibilityClass = element.classList.contains('cm-md-delim-reveal')
        ? 'cm-md-delim-reveal'
        : 'cm-md-delim-hidden';
      return `${visibilityClass}:${element.textContent ?? ''}`;
    }
  );
}

describe('EditorEngine + LiveMarkdownEngine integration', () => {
  it('STEP-003: resolveLiveMarkdownModeGate returns feature-disabled and state-disabled branches', () => {
    expect(resolveLiveMarkdownModeGate(false, true, false)).toEqual({
      attachExtensions: false,
      reason: 'feature-disabled',
    });
    expect(resolveLiveMarkdownModeGate(true, false, false)).toEqual({
      attachExtensions: false,
      reason: 'state-disabled',
    });
  });

  it('AT-COMP-001: live markdown keeps fence highlighting gate disabled for fence flag on/off', () => {
    expect(resolveFenceHighlightGate(true, false, true)).toEqual({
      attachFenceHighlighting: false,
      reason: 'feature-disabled',
    });
    expect(resolveFenceHighlightGate(true, true, true)).toEqual({
      attachFenceHighlighting: false,
      reason: 'live-markdown-active',
    });
  });

  it('AT-COMP-001: semantic live markdown behavior remains stable with fence flag on/off', () => {
    const source = '# Heading\n- Item';
    const snapshots = [false, true].map(enableFenceHighlighting => {
      const { parent, view } = createSemanticEditor(source, {
        enableFenceHighlighting,
      });

      view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 1 } });
      const snapshot = delimiterSnapshot(view);
      const doc = view.state.doc.toString();

      view.destroy();
      parent.remove();

      return { doc, snapshot };
    });

    const withoutFence = snapshots[0];
    const withFence = snapshots[1];

    expect(withoutFence.doc).toBe(source);
    expect(withFence.doc).toBe(source);
    expect(withFence.snapshot).toEqual(withoutFence.snapshot);
  });

  it('applies deterministic heading transform on space input', () => {
    const engine = new LiveMarkdownEngine({
      now: (() => {
        let tick = 0;
        return () => {
          tick += 1;
          return tick;
        };
      })(),
    });

    const result = engine.processInput('#  heading', { line: 0, ch: 10 }, 'space', {
      inCodeFence: false,
      inQuote: false,
      listDepth: 0,
    });

    expect(result.transformed).toBe(true);
    expect(result.replacement).toBe('# heading');
    expect(engine.getLastLatencyMs()).toBeGreaterThan(0);
  });

  it('keeps markdown source byte-fidelity while applying semantic delimiter classes', () => {
    const source = '# Heading\n- Item';
    const { parent, view } = createSemanticEditor(source);

    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 1 } });

    expect(view.state.doc.toString()).toBe(source);
    expect(
      view.dom.querySelectorAll('.cm-md-delim-hidden, .cm-md-delim-reveal').length
    ).toBeGreaterThan(0);

    view.destroy();
    parent.remove();
  });

  it('AT-004: interleaved cursor movement and typing keeps deterministic classes and source bytes', () => {
    const source = 'prefix **bold** and _soft_';
    const { parent, view } = createSemanticEditor(source);

    const line = view.state.doc.line(1);
    const boldStart = line.from + line.text.indexOf('**bold') + 1;
    const softStart = line.from + line.text.indexOf('_soft') + 1;

    expect(() => {
      view.dispatch({ selection: { anchor: boldStart } });
      view.dispatch({ changes: { from: line.to, insert: '!' } });
      view.dispatch({ selection: { anchor: softStart } });
    }).not.toThrow();

    expect(view.state.doc.toString()).toBe(`${source}!`);
    expect(delimiterSnapshot(view)).toEqual([
      'cm-md-delim-hidden:**',
      'cm-md-delim-hidden:**',
      'cm-md-delim-reveal:_',
      'cm-md-delim-hidden:_',
    ]);

    view.destroy();
    parent.remove();
  });

  it('AT-005: malformed inline markdown does not throw or mutate source unexpectedly', () => {
    const malformed = 'broken **open and `tick and [label( plus ~~oops';
    const { parent, view } = createSemanticEditor(malformed);

    expect(() => {
      const line = view.state.doc.line(1);
      view.dispatch({ selection: { anchor: line.from + 3 } });
      view.dispatch({ selection: { anchor: line.from + 10 } });
      view.dispatch({ selection: { anchor: line.from + 15 } });
    }).not.toThrow();

    expect(view.state.doc.toString()).toBe(malformed);
    expect(view.dom.querySelectorAll('.cm-md-delim-reveal').length).toBe(0);

    view.destroy();
    parent.remove();
  });

  it('AT-005: nested malformed delimiters remain safe and deterministic', () => {
    const malformed = 'broken **outer _inner [label(`code ~~oops';
    const { parent, view } = createSemanticEditor(malformed);
    const line = view.state.doc.line(1);

    expect(() => {
      view.dispatch({ selection: { anchor: line.from + 2 } });
      view.dispatch({ selection: { anchor: line.from + 12 } });
      view.dispatch({ selection: { anchor: line.from + 21 } });
    }).not.toThrow();

    const firstSnapshot = delimiterSnapshot(view);
    view.dispatch({ selection: { anchor: line.from + 12 } });
    view.dispatch({ selection: { anchor: line.from + 21 } });
    const secondSnapshot = delimiterSnapshot(view);

    expect(view.state.doc.toString()).toBe(malformed);
    expect(firstSnapshot).toEqual([]);
    expect(secondSnapshot).toEqual(firstSnapshot);

    view.destroy();
    parent.remove();
  });

  it('AT-007: semantic visibility stays active in vim mode', () => {
    let vimMode = false;
    const source = 'line **bold**';
    const { parent, view } = createSemanticEditor(source, {
      isEnabled: () => true,
      isVimEnabled: () => vimMode,
    });

    const line = view.state.doc.line(1);
    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('**bold') + 1 } });
    expect(view.dom.querySelectorAll('.cm-md-delim-reveal').length).toBeGreaterThan(0);

    vimMode = true;
    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('**bold') + 1 } });
    expect(
      view.dom.querySelectorAll('.cm-md-delim-hidden, .cm-md-delim-reveal').length
    ).toBeGreaterThan(0);

    view.destroy();
    parent.remove();
  });
});
