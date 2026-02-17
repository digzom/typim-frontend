import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

interface SemanticMarkdownVisibilityOptions {
  isEnabled: () => boolean;
  isVimEnabled: () => boolean;
}

interface DelimiterRange {
  from: number;
  to: number;
  tokenType:
    | 'heading'
    | 'unordered-list'
    | 'ordered-list'
    | 'blockquote'
    | 'fence'
    | 'strong'
    | 'emphasis'
    | 'inline-code'
    | 'link-label'
    | 'link-url'
    | 'strikethrough';
  lineNumber: number;
}

interface ContentRange {
  from: number;
  to: number;
  className: string;
}

interface DelimiterDecoration {
  from: number;
  to: number;
  className: typeof DELIMITER_CLASS_HIDDEN | typeof DELIMITER_CLASS_REVEAL;
}

const DELIMITER_CLASS_HIDDEN = 'cm-md-delim-hidden';
const DELIMITER_CLASS_REVEAL = 'cm-md-delim-reveal';
const REVEAL_RADIUS_CHARS = 1;

const TOKEN_CONTENT_CLASS: Partial<Record<DelimiterRange['tokenType'], string>> = {
  strong: 'cm-strong',
  emphasis: 'cm-emphasis',
  strikethrough: 'cm-strikethrough',
  'inline-code': 'cm-inline-code',
};

const TOKEN_ORDER: Record<DelimiterRange['tokenType'], number> = {
  heading: 0,
  'unordered-list': 1,
  'ordered-list': 2,
  blockquote: 3,
  fence: 4,
  strong: 5,
  emphasis: 6,
  'inline-code': 7,
  'link-label': 8,
  'link-url': 9,
  strikethrough: 10,
};

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function addBlockRange(
  ranges: DelimiterRange[],
  lineFrom: number,
  lineNumber: number,
  from: number,
  to: number,
  tokenType: DelimiterRange['tokenType']
): void {
  ranges.push({
    from: lineFrom + from,
    to: lineFrom + to,
    tokenType,
    lineNumber,
  });
}

function addPairedMarkerRanges(
  text: string,
  marker: string,
  tokenType: DelimiterRange['tokenType'],
  lineFrom: number,
  lineNumber: number,
  ranges: DelimiterRange[],
  contentRanges: ContentRange[],
  options?: {
    disallowAdjacentMarkerChar?: string;
  }
): void {
  const markerLength = marker.length;
  const openStack: number[] = [];
  const disallowAdjacent = options?.disallowAdjacentMarkerChar;
  const contentClass = TOKEN_CONTENT_CLASS[tokenType];

  for (let index = 0; index <= text.length - markerLength; ) {
    if (text.slice(index, index + markerLength) !== marker || isEscaped(text, index)) {
      index += 1;
      continue;
    }

    if (disallowAdjacent) {
      if (text[index - 1] === disallowAdjacent || text[index + markerLength] === disallowAdjacent) {
        index += markerLength;
        continue;
      }
    }

    if (openStack.length > 0) {
      const start = openStack.pop();
      if (start !== undefined && index > start) {
        ranges.push({
          from: lineFrom + start,
          to: lineFrom + start + markerLength,
          tokenType,
          lineNumber,
        });
        ranges.push({
          from: lineFrom + index,
          to: lineFrom + index + markerLength,
          tokenType,
          lineNumber,
        });

        if (contentClass) {
          const contentFrom = lineFrom + start + markerLength;
          const contentTo = lineFrom + index;
          if (contentTo > contentFrom) {
            contentRanges.push({ from: contentFrom, to: contentTo, className: contentClass });
          }
        }
      }
    } else {
      openStack.push(index);
    }

    index += markerLength;
  }
}

function addInlineCodeRanges(
  text: string,
  lineFrom: number,
  lineNumber: number,
  ranges: DelimiterRange[],
  contentRanges: ContentRange[]
): void {
  const openStack: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '`' || isEscaped(text, index)) {
      continue;
    }

    if (text[index - 1] === '`' || text[index + 1] === '`') {
      continue;
    }

    if (openStack.length > 0) {
      const start = openStack.pop();
      if (start !== undefined && index > start + 1) {
        ranges.push({
          from: lineFrom + start,
          to: lineFrom + start + 1,
          tokenType: 'inline-code',
          lineNumber,
        });
        ranges.push({
          from: lineFrom + index,
          to: lineFrom + index + 1,
          tokenType: 'inline-code',
          lineNumber,
        });

        const contentFrom = lineFrom + start + 1;
        const contentTo = lineFrom + index;
        if (contentTo > contentFrom) {
          contentRanges.push({ from: contentFrom, to: contentTo, className: 'cm-inline-code' });
        }
      }
    } else {
      openStack.push(index);
    }
  }
}

function addLinkRanges(
  text: string,
  lineFrom: number,
  lineNumber: number,
  ranges: DelimiterRange[]
): void {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '[' || isEscaped(text, index)) {
      continue;
    }

    let labelEnd = -1;
    for (let cursor = index + 1; cursor < text.length; cursor += 1) {
      if (text[cursor] === ']' && !isEscaped(text, cursor)) {
        labelEnd = cursor;
        break;
      }
    }

    if (
      labelEnd <= index + 1 ||
      text[labelEnd + 1] !== '(' ||
      text[labelEnd + 2] === undefined ||
      text[labelEnd + 2] === ')'
    ) {
      continue;
    }

    let urlEnd = -1;
    for (let cursor = labelEnd + 2; cursor < text.length; cursor += 1) {
      if (text[cursor] === ')' && !isEscaped(text, cursor)) {
        urlEnd = cursor;
        break;
      }
    }

    if (urlEnd <= labelEnd + 2) {
      continue;
    }

    ranges.push({
      from: lineFrom + index,
      to: lineFrom + index + 1,
      tokenType: 'link-label',
      lineNumber,
    });
    ranges.push({
      from: lineFrom + labelEnd,
      to: lineFrom + labelEnd + 1,
      tokenType: 'link-label',
      lineNumber,
    });
    ranges.push({
      from: lineFrom + labelEnd + 1,
      to: lineFrom + labelEnd + 2,
      tokenType: 'link-url',
      lineNumber,
    });
    ranges.push({
      from: lineFrom + urlEnd,
      to: lineFrom + urlEnd + 1,
      tokenType: 'link-url',
      lineNumber,
    });

    index = urlEnd;
  }
}

interface LineParseResult {
  delimiterRanges: DelimiterRange[];
  contentRanges: ContentRange[];
}

function getDelimiterRangesForLine(
  lineText: string,
  lineFrom: number,
  lineNumber: number
): LineParseResult {
  const ranges: DelimiterRange[] = [];
  const contentRanges: ContentRange[] = [];

  const headingMatch = lineText.match(/^(\s*)(#{1,6})(\s+)/);
  if (headingMatch) {
    const prefixLength = (headingMatch[1] ?? '').length;
    const markerLength = (headingMatch[2] ?? '').length + (headingMatch[3] ?? '').length;
    addBlockRange(
      ranges,
      lineFrom,
      lineNumber,
      prefixLength,
      prefixLength + markerLength,
      'heading'
    );
  } else {
    const unorderedListMatch = lineText.match(/^(\s*)([-*+])(\s+)/);
    if (unorderedListMatch) {
      const prefixLength = (unorderedListMatch[1] ?? '').length;
      const markerLength =
        (unorderedListMatch[2] ?? '').length + (unorderedListMatch[3] ?? '').length;
      addBlockRange(
        ranges,
        lineFrom,
        lineNumber,
        prefixLength,
        prefixLength + markerLength,
        'unordered-list'
      );
    } else {
      const orderedListMatch = lineText.match(/^(\s*)(\d+\.)(\s+)/);
      if (orderedListMatch) {
        const prefixLength = (orderedListMatch[1] ?? '').length;
        const markerLength =
          (orderedListMatch[2] ?? '').length + (orderedListMatch[3] ?? '').length;
        addBlockRange(
          ranges,
          lineFrom,
          lineNumber,
          prefixLength,
          prefixLength + markerLength,
          'ordered-list'
        );
      } else {
        const blockquoteMatch = lineText.match(/^(\s*)(>\s?)/);
        if (blockquoteMatch) {
          const prefixLength = (blockquoteMatch[1] ?? '').length;
          const markerLength = (blockquoteMatch[2] ?? '').length;
          addBlockRange(
            ranges,
            lineFrom,
            lineNumber,
            prefixLength,
            prefixLength + markerLength,
            'blockquote'
          );
        }
      }
    }
  }

  const fenceMatch = lineText.match(/^(\s*)(`{3,}|~{3,})/);
  if (fenceMatch) {
    const prefixLength = (fenceMatch[1] ?? '').length;
    const markerLength = (fenceMatch[2] ?? '').length;
    addBlockRange(ranges, lineFrom, lineNumber, prefixLength, prefixLength + markerLength, 'fence');
  }

  addPairedMarkerRanges(lineText, '**', 'strong', lineFrom, lineNumber, ranges, contentRanges);
  addPairedMarkerRanges(lineText, '__', 'strong', lineFrom, lineNumber, ranges, contentRanges);
  addPairedMarkerRanges(lineText, '~~', 'strikethrough', lineFrom, lineNumber, ranges, contentRanges);
  addPairedMarkerRanges(lineText, '*', 'emphasis', lineFrom, lineNumber, ranges, contentRanges, {
    disallowAdjacentMarkerChar: '*',
  });
  addPairedMarkerRanges(lineText, '_', 'emphasis', lineFrom, lineNumber, ranges, contentRanges, {
    disallowAdjacentMarkerChar: '_',
  });
  addInlineCodeRanges(lineText, lineFrom, lineNumber, ranges, contentRanges);
  addLinkRanges(lineText, lineFrom, lineNumber, ranges);

  ranges.sort((left, right) => {
    if (left.from !== right.from) {
      return left.from - right.from;
    }

    if (left.to !== right.to) {
      return left.to - right.to;
    }

    return TOKEN_ORDER[left.tokenType] - TOKEN_ORDER[right.tokenType];
  });

  contentRanges.sort((left, right) => left.from - right.from);

  return { delimiterRanges: ranges, contentRanges };
}

function getActiveLines(view: EditorView): Set<number> {
  const activeLines = new Set<number>();

  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from).number;
    const endLine = view.state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      activeLines.add(lineNumber);
    }
  }

  return activeLines;
}

function intersects(fromA: number, toA: number, fromB: number, toB: number): boolean {
  return fromA < toB && toA > fromB;
}

function buildDelimiterDecorations(
  ranges: DelimiterRange[],
  selectionRanges: Array<{ from: number; to: number }>,
  activeLines: Set<number>,
  revealRadiusChars: number
): DelimiterDecoration[] {
  return ranges.map(range => {
    let shouldReveal = false;

    for (const selectionRange of selectionRanges) {
      if (selectionRange.from !== selectionRange.to) {
        if (intersects(range.from, range.to, selectionRange.from, selectionRange.to)) {
          shouldReveal = true;
          break;
        }
        continue;
      }

      if (!activeLines.has(range.lineNumber)) {
        continue;
      }

      const revealFrom = Math.max(selectionRange.from - revealRadiusChars, 0);
      const revealTo = selectionRange.to + revealRadiusChars + 1;
      if (intersects(range.from, range.to, revealFrom, revealTo)) {
        shouldReveal = true;
        break;
      }
    }

    return {
      from: range.from,
      to: range.to,
      className: shouldReveal ? DELIMITER_CLASS_REVEAL : DELIMITER_CLASS_HIDDEN,
    };
  });
}

function collectViewportLines(view: EditorView): Set<number> {
  const lines = new Set<number>();

  for (const range of view.visibleRanges) {
    let line = view.state.doc.lineAt(range.from);
    while (line.from <= range.to && line.number <= view.state.doc.lines) {
      lines.add(line.number);
      if (line.number >= view.state.doc.lines) {
        break;
      }
      line = view.state.doc.line(line.number + 1);
    }
  }

  return lines;
}

function buildSemanticDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLines = getActiveLines(view);
  const selectionRanges = view.state.selection.ranges.map(range => ({
    from: range.from,
    to: range.to,
  }));
  const linesToProcess = collectViewportLines(view);

  for (const lineNumber of activeLines) {
    linesToProcess.add(lineNumber);
  }

  const allDecorations: Array<{ from: number; to: number; decoration: Decoration }> = [];

  const orderedLineNumbers = Array.from(linesToProcess).sort((left, right) => left - right);
  for (const lineNumber of orderedLineNumbers) {
    if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
      continue;
    }

    const line = view.state.doc.line(lineNumber);
    const { delimiterRanges, contentRanges } = getDelimiterRangesForLine(
      line.text,
      line.from,
      line.number
    );
    const decorations = buildDelimiterDecorations(
      delimiterRanges,
      selectionRanges,
      activeLines,
      REVEAL_RADIUS_CHARS
    );

    for (const decoration of decorations) {
      allDecorations.push({
        from: decoration.from,
        to: decoration.to,
        decoration: Decoration.mark({ class: decoration.className }),
      });
    }

    for (const content of contentRanges) {
      allDecorations.push({
        from: content.from,
        to: content.to,
        decoration: Decoration.mark({ class: content.className }),
      });
    }
  }

  allDecorations.sort((left, right) => {
    if (left.from !== right.from) {
      return left.from - right.from;
    }
    return left.to - right.to;
  });

  for (const entry of allDecorations) {
    builder.add(entry.from, entry.to, entry.decoration);
  }

  return builder.finish();
}

export function createSemanticMarkdownVisibilityExtension(
  options: SemanticMarkdownVisibilityOptions
): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = options.isEnabled()
          ? buildSemanticDecorations(view)
          : Decoration.none;
      }

      update(update: ViewUpdate): void {
        if (!options.isEnabled()) {
          this.decorations = Decoration.none;
          return;
        }

        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.focusChanged
        ) {
          this.decorations = buildSemanticDecorations(update.view);
        }
      }
    },
    {
      decorations: instance => instance.decorations,
    }
  );
}

export const semanticMarkdownDelimiterClasses = [DELIMITER_CLASS_HIDDEN, DELIMITER_CLASS_REVEAL];
