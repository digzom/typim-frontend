import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { createMarkdownExtension } from '../../../../src/editor/cm6/extensions/markdown';
import { createSemanticMarkdownVisibilityExtension } from '../../../../src/editor/cm6/extensions/semantic-markdown';

function createView(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);

  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        createMarkdownExtension(),
        createSemanticMarkdownVisibilityExtension({
          isEnabled: () => true,
          isVimEnabled: () => false,
        }),
      ],
    }),
  });
}

function markerSnapshot(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll('.cm-md-delim-hidden, .cm-md-delim-reveal')).map(
    node => {
      const element = node as HTMLElement;
      return `${element.className}:${element.textContent ?? ''}`;
    }
  );
}

function markerClassCount(view: EditorView, text: string, className: string): number {
  return Array.from(view.dom.querySelectorAll('.cm-md-delim-hidden, .cm-md-delim-reveal')).filter(
    node => node.classList.contains(className) && (node.textContent ?? '') === text
  ).length;
}

function markerClassExists(view: EditorView, text: string, className: string): boolean {
  return markerClassCount(view, text, className) > 0;
}

describe('semantic markdown extension', () => {
  it('AT-001: hides strong/emphasis delimiters off-caret and reveals at active caret', () => {
    const doc = ['# Heading', 'lead **bold** and _soft_', 'tail'].join('\n');
    const view = createView(doc);

    const firstLine = view.state.doc.line(1);
    view.dispatch({ selection: { anchor: firstLine.from + 1 } });

    expect(markerClassExists(view, '**', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, '_', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassCount(view, '**', 'cm-md-delim-reveal')).toBe(0);

    const inlineLine = view.state.doc.line(2);
    const boldCaret = inlineLine.from + inlineLine.text.indexOf('**bold') + 1;
    view.dispatch({ selection: { anchor: boldCaret } });

    expect(markerClassExists(view, '**', 'cm-md-delim-reveal')).toBe(true);

    const emphasisCaret = inlineLine.from + inlineLine.text.indexOf('_soft') + 1;
    view.dispatch({ selection: { anchor: emphasisCaret } });

    expect(markerClassExists(view, '_', 'cm-md-delim-reveal')).toBe(true);
    expect(view.state.doc.toString()).toBe(doc);

    view.destroy();
    view.dom.parentElement?.remove();
  });

  it('AT-002: applies reveal policy to inline code, links, and strikethrough delimiters', () => {
    const doc = 'line `code` [label](url) ~~gone~~';
    const view = createView(doc);

    expect(markerClassExists(view, '`', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, '[', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, ']', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, '(', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, ')', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, '~~', 'cm-md-delim-hidden')).toBe(true);

    const line = view.state.doc.line(1);
    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('`code') + 1 } });
    expect(markerClassExists(view, '`', 'cm-md-delim-reveal')).toBe(true);

    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('[label') + 1 } });
    expect(markerClassExists(view, '[', 'cm-md-delim-reveal')).toBe(true);
    expect(markerClassCount(view, ']', 'cm-md-delim-reveal')).toBe(0);

    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('](url') + 1 } });
    expect(markerClassExists(view, ']', 'cm-md-delim-reveal')).toBe(true);
    expect(markerClassExists(view, '(', 'cm-md-delim-reveal')).toBe(true);
    expect(markerClassCount(view, ')', 'cm-md-delim-reveal')).toBe(0);

    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('(url') + 1 } });
    expect(markerClassExists(view, '(', 'cm-md-delim-reveal')).toBe(true);
    expect(markerClassCount(view, ')', 'cm-md-delim-reveal')).toBe(0);

    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('url)') + 3 } });
    expect(markerClassExists(view, ')', 'cm-md-delim-reveal')).toBe(true);

    view.dispatch({ selection: { anchor: line.from + line.text.indexOf('~~gone') + 1 } });
    expect(markerClassExists(view, '~~', 'cm-md-delim-reveal')).toBe(true);

    const selectionStart = line.from + line.text.indexOf('[');
    const selectionEnd = line.from + line.text.indexOf(']') + 1;
    view.dispatch({ selection: { anchor: selectionStart, head: selectionEnd } });
    expect(markerClassExists(view, '[', 'cm-md-delim-reveal')).toBe(true);
    expect(markerClassExists(view, ']', 'cm-md-delim-reveal')).toBe(true);

    view.destroy();
    view.dom.parentElement?.remove();
  });

  it('AT-003: is idempotent for unchanged cursor and content', () => {
    const doc = 'combo **bold** _soft_ `code`';
    const view = createView(doc);

    const line = view.state.doc.line(1);
    const boldCaret = line.from + line.text.indexOf('**bold') + 1;
    const softCaret = line.from + line.text.indexOf('_soft') + 1;
    const codeCaret = line.from + line.text.indexOf('`code') + 1;

    view.dispatch({ selection: { anchor: boldCaret } });
    const baselineSnapshot = markerSnapshot(view);

    view.dispatch({ selection: { anchor: softCaret } });
    view.dispatch({ selection: { anchor: boldCaret } });
    const firstRecomputeSnapshot = markerSnapshot(view);

    view.dispatch({ selection: { anchor: codeCaret } });
    view.dispatch({ selection: { anchor: boldCaret } });
    const secondRecomputeSnapshot = markerSnapshot(view);

    const noOpBaselineSnapshot = markerSnapshot(view);
    view.dispatch({ selection: { anchor: boldCaret } });
    const noOpFirstCycleSnapshot = markerSnapshot(view);
    view.dispatch({ selection: { anchor: boldCaret } });
    const noOpSecondCycleSnapshot = markerSnapshot(view);

    expect(firstRecomputeSnapshot).toEqual(baselineSnapshot);
    expect(secondRecomputeSnapshot).toEqual(baselineSnapshot);
    expect(noOpFirstCycleSnapshot).toEqual(noOpBaselineSnapshot);
    expect(noOpSecondCycleSnapshot).toEqual(noOpFirstCycleSnapshot);
    expect(view.state.doc.toString()).toBe(doc);

    view.destroy();
    view.dom.parentElement?.remove();
  });

  it('applies hide/reveal policy to ordered-list and blockquote markers', () => {
    const doc = ['1. first item', '> quote line'].join('\n');
    const view = createView(doc);

    const quoteLine = view.state.doc.line(2);
    view.dispatch({ selection: { anchor: quoteLine.from + 3 } });

    expect(markerClassExists(view, '1. ', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassExists(view, '> ', 'cm-md-delim-hidden')).toBe(true);
    expect(markerClassCount(view, '1. ', 'cm-md-delim-reveal')).toBe(0);

    const orderedLine = view.state.doc.line(1);
    view.dispatch({ selection: { anchor: orderedLine.from + 1 } });
    expect(markerClassExists(view, '1. ', 'cm-md-delim-reveal')).toBe(true);

    view.dispatch({ selection: { anchor: quoteLine.from + 1 } });
    expect(markerClassExists(view, '> ', 'cm-md-delim-reveal')).toBe(true);

    view.destroy();
    view.dom.parentElement?.remove();
  });

  it('extracts adjacent inline delimiters for nested-style fixtures deterministically', () => {
    const doc = 'mix **bold**_tight_ and ~~gone~~`code`';
    const view = createView(doc);

    const markers = markerSnapshot(view).join('|');
    expect(markers.includes('cm-md-delim-hidden:**')).toBe(true);
    expect(markers.includes('cm-md-delim-hidden:_')).toBe(true);
    expect(markers.includes('cm-md-delim-hidden:~~')).toBe(true);
    expect(markers.includes('cm-md-delim-hidden:`')).toBe(true);

    view.destroy();
    view.dom.parentElement?.remove();
  });

  it('detects tilde code fences as semantic delimiters', () => {
    const doc = ['~~~ts', 'const a = 1', '~~~'].join('\n');
    const view = createView(doc);

    const revealedFenceNodesAtStart = Array.from(
      view.dom.querySelectorAll('.cm-md-delim-reveal')
    ).filter(node => (node.textContent ?? '').includes('~~~'));
    expect(revealedFenceNodesAtStart.length).toBe(1);

    const hiddenFenceNodes = Array.from(view.dom.querySelectorAll('.cm-md-delim-hidden')).filter(
      node => (node.textContent ?? '').includes('~~~')
    );
    expect(hiddenFenceNodes.length).toBe(1);

    const fenceLine = view.state.doc.line(1);
    view.dispatch({ selection: { anchor: fenceLine.from + 1 } });

    const revealedFenceNodes = Array.from(view.dom.querySelectorAll('.cm-md-delim-reveal')).filter(
      node => (node.textContent ?? '').includes('~~~')
    );
    expect(revealedFenceNodes.length).toBe(1);

    view.destroy();
    view.dom.parentElement?.remove();
  });
});
