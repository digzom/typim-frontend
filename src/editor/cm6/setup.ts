/**
 * CodeMirror 6 setup and initialization
 * @module editor/cm6/setup
 */

import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { CursorPosition, ScrollInfo } from '../../core/types';
import { Logger } from '../../core/errors';
import { createScrolloffExtension } from './extensions/scrolloff';

const logger = new Logger('production');

export type LineNumberMode = 'absolute' | 'relative';

const lineNumberCompartment = new Compartment();

function createLineNumbersExtension(mode: LineNumberMode): Extension {
  if (mode === 'relative') {
    return lineNumbers({
      formatNumber: (lineNo, state) => {
        const activeLine = state.doc.lineAt(state.selection.main.head).number;
        if (lineNo === activeLine) {
          return String(lineNo);
        }

        return String(Math.abs(lineNo - activeLine));
      },
    });
  }

  return lineNumbers();
}

/**
 * Create a CodeMirror 6 editor instance
 * @param container - DOM element to mount editor
 * @param initialValue - Initial document content
 * @param extensions - Additional extensions to include
 * @returns EditorView instance
 */
export function createEditor(
  container: HTMLElement,
  initialValue = '',
  extensions: Extension[] = []
): EditorView {
  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      // Core extensions
      history(),
      lineNumberCompartment.of(createLineNumbersExtension('absolute')),
      createScrolloffExtension(),

      // Keymap
      keymap.of([...defaultKeymap, ...historyKeymap]),

      // Custom extensions
      ...extensions,

      // Base theme configuration
      EditorView.theme({
        '&': {
          fontSize: 'var(--text-base)',
          fontFamily: 'var(--font-mono)',
        },
        '.cm-content': {
          fontFamily: 'var(--font-mono)',
          lineHeight: 'var(--leading-relaxed)',
          padding: 'var(--space-4)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--color-bg-tertiary)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--color-bg-secondary)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--color-editor-cursor)',
        },
        '.cm-selectionBackground': {
          backgroundColor: 'var(--color-editor-selection)',
        },
      }),

      // Update listener for document changes
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          // Document changed - will be handled by IEditorEngine
          logger.debug('Document changed', { length: update.state.doc.length });
        }
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return view;
}

/**
 * Get document value from editor
 * @param view - EditorView instance
 * @returns Current document text
 */
export function getValue(view: EditorView): string {
  return view.state.doc.toString();
}

/**
 * Set document value in editor
 * @param view - EditorView instance
 * @param value - New document text
 */
export function setValue(view: EditorView, value: string): void {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: value,
    },
  });
}

/**
 * Get cursor position
 * @param view - EditorView instance
 * @returns Cursor position
 */
export function getCursor(view: EditorView): CursorPosition {
  const selection = view.state.selection.main;
  const line = view.state.doc.lineAt(selection.head);
  return {
    line: line.number - 1, // 0-indexed
    ch: selection.head - line.from,
  };
}

/**
 * Set cursor position
 * @param view - EditorView instance
 * @param pos - Cursor position
 */
export function setCursor(view: EditorView, pos: CursorPosition): void {
  const line = view.state.doc.line(pos.line + 1); // Convert to 1-indexed
  const offset = line.from + pos.ch;
  view.dispatch({
    selection: { anchor: offset, head: offset },
  });
}

/**
 * Get scroll info
 * @param view - EditorView instance
 * @returns Scroll information
 */
export function getScrollInfo(view: EditorView): ScrollInfo {
  const scrollDOM = view.scrollDOM;
  return {
    top: scrollDOM.scrollTop,
    height: scrollDOM.scrollHeight,
    clientHeight: scrollDOM.clientHeight,
  };
}

/**
 * Scroll to position
 * @param view - EditorView instance
 * @param top - Scroll position
 */
export function scrollTo(view: EditorView, top: number): void {
  view.scrollDOM.scrollTop = top;
}

/**
 * Focus the editor
 * @param view - EditorView instance
 */
export function focus(view: EditorView): void {
  view.focus();
}

/**
 * Check if editor has focus
 * @param view - EditorView instance
 * @returns True if editor has focus
 */
export function hasFocus(view: EditorView): boolean {
  return view.hasFocus;
}

/**
 * Destroy the editor instance
 * @param view - EditorView instance
 */
export function destroy(view: EditorView): void {
  view.destroy();
}

export function setLineNumberMode(view: EditorView, mode: LineNumberMode): void {
  view.dispatch({
    effects: lineNumberCompartment.reconfigure(createLineNumbersExtension(mode)),
  });
}
