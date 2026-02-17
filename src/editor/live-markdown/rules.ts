import type { CursorPosition } from '../../core/types';
import type { BlockContext, InputTrigger, TransformRule, TransformRuleResult } from './types';

interface TransformMatch {
  rule: TransformRule;
  result: TransformRuleResult;
}

const HEADING_PATTERN = /^(\s*)(#{1,})(\s{2,})(.*)$/;
const UNORDERED_LIST_PATTERN = /^(\s*)([-*+])(\s{2,})(.*)$/;
const ORDERED_LIST_PATTERN = /^(\s*)(\d+)\.(\s{2,})(.*)$/;
const BLOCKQUOTE_PATTERN = /^(\s*)>(\s{2,})(.*)$/;
const CODE_FENCE_PATTERN = /^(\s*)(```|~~~)([A-Za-z0-9_-]*)\s{2,}$/;
const HR_PATTERN = /^\s*([-*_])(?:\s*\1){2,}\s{2,}$/;

export function isAmbiguousRawPattern(line: string): boolean {
  const trimmed = line.trimStart();
  if (trimmed.length === 0) {
    return false;
  }

  // INV-003-AmbiguousRaw guard: marker immediately followed by text.
  if (/^#{1,6}\S/.test(trimmed)) {
    return true;
  }
  if (/^(?:[-*+]|\d+\.)\S/.test(trimmed)) {
    return true;
  }
  if (/^>\S/.test(trimmed)) {
    return true;
  }

  return false;
}

function buildTransformResult(replacement: string): TransformRuleResult {
  return {
    transformed: true,
    replacement,
    newCursor: {
      line: 0,
      ch: replacement.length,
    },
  };
}

const codeFenceRule: TransformRule = {
  id: 'code-fence',
  precedence: 1,
  triggers: ['space'],
  matches(line, _cursor, _context) {
    return CODE_FENCE_PATTERN.test(line) && !isAmbiguousRawPattern(line);
  },
  apply(line) {
    const match = line.match(CODE_FENCE_PATTERN);
    if (!match) {
      return { transformed: false };
    }
    const indent = match[1] ?? '';
    const fence = match[2] ?? '```';
    const language = match[3] ?? '';
    const normalized = `${indent}${fence}${language}`;
    return {
      ...buildTransformResult(normalized),
      toggleCodeFence: true,
    };
  },
};

const horizontalRuleRule: TransformRule = {
  id: 'horizontal-rule',
  precedence: 2,
  triggers: ['space'],
  matches(line, _cursor, context) {
    if (context.inCodeFence) {
      return false;
    }
    return HR_PATTERN.test(line);
  },
  apply(line) {
    const markerMatch = line.trimStart().match(/^([-*_])/);
    const marker = markerMatch?.[1] ?? '-';
    const indent = line.match(/^\s*/)?.[0] ?? '';
    return buildTransformResult(`${indent}${marker}${marker}${marker}`);
  },
};

const headingRule: TransformRule = {
  id: 'heading',
  precedence: 3,
  triggers: ['space'],
  matches(line, _cursor, context) {
    if (context.inCodeFence || isAmbiguousRawPattern(line)) {
      return false;
    }
    return HEADING_PATTERN.test(line);
  },
  apply(line) {
    const match = line.match(HEADING_PATTERN);
    if (!match) {
      return { transformed: false };
    }

    const indent = match[1] ?? '';
    const marker = match[2] ?? '#';
    const content = match[4] ?? '';
    const clampedMarker = '#'.repeat(Math.min(6, marker.length));
    const replacement =
      content.length > 0 ? `${indent}${clampedMarker} ${content}` : `${indent}${clampedMarker} `;

    return buildTransformResult(replacement);
  },
};

const orderedListRule: TransformRule = {
  id: 'ordered-list',
  precedence: 4,
  triggers: ['space'],
  matches(line, _cursor, context) {
    if (context.inCodeFence || isAmbiguousRawPattern(line)) {
      return false;
    }
    // Column 0 ignoring whitespace: only leading spaces before marker.
    return ORDERED_LIST_PATTERN.test(line);
  },
  apply(line) {
    const match = line.match(ORDERED_LIST_PATTERN);
    if (!match) {
      return { transformed: false };
    }
    const indent = match[1] ?? '';
    const index = match[2] ?? '1';
    const content = match[4] ?? '';
    const replacement =
      content.length > 0 ? `${indent}${index}. ${content}` : `${indent}${index}. `;

    return buildTransformResult(replacement);
  },
};

const unorderedListRule: TransformRule = {
  id: 'unordered-list',
  precedence: 5,
  triggers: ['space'],
  matches(line, _cursor, context) {
    if (context.inCodeFence || isAmbiguousRawPattern(line)) {
      return false;
    }
    // Column 0 ignoring whitespace: only leading spaces before marker.
    return UNORDERED_LIST_PATTERN.test(line);
  },
  apply(line) {
    const match = line.match(UNORDERED_LIST_PATTERN);
    if (!match) {
      return { transformed: false };
    }

    const indent = match[1] ?? '';
    const marker = match[2] ?? '-';
    const content = match[4] ?? '';
    const replacement =
      content.length > 0 ? `${indent}${marker} ${content}` : `${indent}${marker} `;

    return buildTransformResult(replacement);
  },
};

const blockquoteRule: TransformRule = {
  id: 'blockquote',
  precedence: 6,
  triggers: ['space'],
  matches(line, _cursor, context) {
    if (context.inCodeFence || isAmbiguousRawPattern(line)) {
      return false;
    }
    return BLOCKQUOTE_PATTERN.test(line);
  },
  apply(line) {
    const match = line.match(BLOCKQUOTE_PATTERN);
    if (!match) {
      return { transformed: false };
    }
    const indent = match[1] ?? '';
    const content = match[3] ?? '';
    const replacement = content.length > 0 ? `${indent}> ${content}` : `${indent}> `;

    return buildTransformResult(replacement);
  },
};

export const TRANSFORM_RULES: readonly TransformRule[] = [
  codeFenceRule,
  horizontalRuleRule,
  headingRule,
  orderedListRule,
  unorderedListRule,
  blockquoteRule,
] as const;

export function findTransformRule(
  line: string,
  cursor: CursorPosition,
  context: BlockContext,
  trigger: InputTrigger
): TransformMatch | null {
  const orderedRules = [...TRANSFORM_RULES].sort(
    (left, right) => left.precedence - right.precedence
  );

  for (const rule of orderedRules) {
    if (!rule.triggers.includes(trigger)) {
      continue;
    }

    if (!rule.matches(line, cursor, context)) {
      continue;
    }

    const result = rule.apply(line, cursor, context);
    if (result.transformed) {
      return { rule, result };
    }
  }

  return null;
}

function getListDepth(line: string): number {
  const match = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+/);
  if (!match) {
    return 0;
  }

  const indent = (match[1] ?? '').length;
  return Math.floor(indent / 2) + 1;
}

export function deriveBlockContextFromLines(
  lines: readonly string[],
  lineNumber: number,
  column: number,
  vimMode = false
): BlockContext {
  let inCodeFence = false;

  for (let index = 0; index <= lineNumber; index += 1) {
    if (/^\s*(?:```|~~~)/.test(lines[index] ?? '')) {
      inCodeFence = !inCodeFence;
    }
  }

  const currentLine = lines[lineNumber] ?? '';
  const previousLineText = lineNumber > 0 ? (lines[lineNumber - 1] ?? '') : '';

  return {
    lineNumber,
    column,
    inCodeFence,
    inBlockquote: /^\s*>/.test(currentLine),
    listDepth: getListDepth(currentLine),
    previousLineText,
    vimMode,
  };
}
