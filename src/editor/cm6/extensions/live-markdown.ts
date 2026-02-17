import { Transaction, type Extension, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import type { CursorPosition } from '../../../core/types';
import { LiveMarkdownEngine } from '../../live-markdown/engine';
import { deriveBlockContextFromLines } from '../../live-markdown/rules';
import type { InputTrigger } from '../../live-markdown/types';

interface LiveMarkdownExtensionOptions {
  isEnabled: () => boolean;
  isVimEnabled: () => boolean;
}

function detectTrigger(insertedText: string): InputTrigger | null {
  if (insertedText.length === 0) {
    return null;
  }

  if (insertedText === ' ') {
    return 'space';
  }

  if (insertedText.includes('\n')) {
    return 'enter';
  }

  if (insertedText.length > 1) {
    return 'paste';
  }

  return null;
}

function extractInsertedText(update: ViewUpdate): string {
  let insertedText = '';

  for (const transaction of update.transactions) {
    if (!transaction.docChanged) {
      continue;
    }

    transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      insertedText += inserted.toString();
    });
  }

  return insertedText;
}

function getHeadingLevel(text: string): number {
  const match = text.match(/^(\s*)(#{1,6})\s/);
  if (!match) {
    return 0;
  }
  return (match[2] ?? '').length;
}

function getLineClass(text: string): string | null {
  const headingLevel = getHeadingLevel(text);
  if (headingLevel > 0) {
    return `cm-livemd-heading cm-livemd-heading-${headingLevel}`;
  }
  if (/^\s*[-*+]\s/.test(text)) {
    return 'cm-livemd-unordered-list';
  }
  if (/^\s*\d+\.\s/.test(text)) {
    return 'cm-livemd-ordered-list';
  }
  if (/^\s*>\s?/.test(text)) {
    return 'cm-livemd-blockquote';
  }
  if (/^\s*```/.test(text)) {
    return 'cm-livemd-code-fence';
  }
  if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
    return 'cm-livemd-horizontal-rule';
  }

  return null;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    const lineClass = getLineClass(line.text);
    if (!lineClass) {
      continue;
    }

    builder.add(
      line.from,
      line.from,
      Decoration.line({
        attributes: { class: lineClass },
      })
    );
  }

  return builder.finish();
}

function mapCursor(lineIndex: number, ch: number): CursorPosition {
  return { line: lineIndex, ch };
}

function createLiveMarkdownTheme(): Extension {
  return EditorView.baseTheme({
    '.cm-line.cm-livemd-heading': {
      fontWeight: '600',
    },
    '.cm-line.cm-livemd-heading-1': {
      fontSize: '2em',
      lineHeight: '1.2',
    },
    '.cm-line.cm-livemd-heading-2': {
      fontSize: '1.5em',
      lineHeight: '1.25',
    },
    '.cm-line.cm-livemd-heading-3': {
      fontSize: '1.25em',
      lineHeight: '1.3',
    },
    '.cm-line.cm-livemd-heading-4': {
      fontSize: '1.1em',
      lineHeight: '1.35',
    },
    '.cm-line.cm-livemd-heading-5': {
      fontSize: '1em',
      lineHeight: '1.4',
    },
    '.cm-line.cm-livemd-heading-6': {
      fontSize: '0.9em',
      lineHeight: '1.4',
    },
    '.cm-line.cm-livemd-unordered-list, .cm-line.cm-livemd-ordered-list': {
      paddingLeft: '0.25rem',
    },
    '.cm-line.cm-livemd-blockquote': {
      borderLeft: '2px solid var(--color-border-strong)',
      paddingLeft: '0.5rem',
      color: 'var(--color-text-secondary)',
    },
    '.cm-line.cm-livemd-code-fence': {
      fontFamily: 'var(--font-mono)',
    },
    '.cm-line.cm-livemd-horizontal-rule': {
      color: 'var(--color-text-tertiary)',
    },
  });
}

export function createLiveMarkdownExtension(
  engine: LiveMarkdownEngine,
  options: LiveMarkdownExtensionOptions
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private applying = false;

      private scheduleDispatch(
        view: EditorView,
        transactionSpec: Parameters<EditorView['dispatch']>[0]
      ): void {
        queueMicrotask(() => {
          this.applying = true;

          try {
            view.dispatch(transactionSpec);
          } finally {
            this.applying = false;
          }
        });
      }

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged) {
          this.decorations = buildDecorations(update.view);
        }

        if (!update.docChanged || this.applying || !options.isEnabled() || options.isVimEnabled()) {
          return;
        }

        const insertedText = extractInsertedText(update);
        const trigger = detectTrigger(insertedText);
        if (!trigger) {
          return;
        }

        const head = update.state.selection.main.head;
        const lineInfo = update.state.doc.lineAt(head);
        const lineIndex = lineInfo.number - 1;
        const column = head - lineInfo.from;

        if (trigger === 'enter' && lineInfo.text.trim() === '' && lineInfo.number > 1) {
          const previousLine = update.state.doc.line(lineInfo.number - 1);
          const isEmptyListLine = /^\s*(?:[-*+]|\d+\.)\s*$/.test(previousLine.text);
          const isEmptyQuoteLine = /^\s*>\s*$/.test(previousLine.text);

          if (isEmptyListLine || isEmptyQuoteLine) {
            this.scheduleDispatch(update.view, {
              changes: {
                from: previousLine.from,
                to: lineInfo.from,
                insert: '',
              },
              selection: { anchor: previousLine.from },
              annotations: Transaction.userEvent.of('input.livemd'),
            });
            return;
          }
        }

        const documentLines = update.state.doc.toString().split('\n');
        const context = deriveBlockContextFromLines(
          documentLines,
          lineIndex,
          column,
          options.isVimEnabled()
        );

        const result = engine.processInput(lineInfo.text, mapCursor(lineIndex, column), trigger, {
          inCodeFence: context.inCodeFence,
          inQuote: context.inBlockquote,
          listDepth: context.listDepth,
          previousLineText: context.previousLineText,
          vimMode: context.vimMode,
          lineNumber: context.lineNumber,
          column: context.column,
        });

        if (
          !result.transformed ||
          result.replacement === undefined ||
          result.replacement === lineInfo.text
        ) {
          return;
        }

        const nextCursor = lineInfo.from + (result.newCursor?.ch ?? result.replacement.length);

        this.scheduleDispatch(update.view, {
          changes: {
            from: lineInfo.from,
            to: lineInfo.to,
            insert: result.replacement,
          },
          selection: { anchor: nextCursor },
          annotations: Transaction.userEvent.of('input.livemd'),
        });
      }
    },
    {
      decorations: instance => instance.decorations,
    }
  );

  return [plugin, createLiveMarkdownTheme()];
}
