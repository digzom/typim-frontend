import type { BlockContext, ExitRule, ExitRuleResult, InputTrigger } from './types';

const EMPTY_LIST_ITEM_PATTERN = /^(\s*)(?:[-*+]|\d+\.)\s*$/;
const ORDERED_LIST_WITH_CONTENT_PATTERN = /^(\s*)(\d+)\.\s+\S.*$/;
const EMPTY_BLOCKQUOTE_PATTERN = /^(\s*)>\s*$/;
const CODE_FENCE_PATTERN = /^\s*```[A-Za-z0-9_-]*\s*$/;

const emptyListEnterRule: ExitRule = {
  id: 'empty-list-enter',
  triggers: ['enter'],
  matches(line, context) {
    return !context.inCodeFence && EMPTY_LIST_ITEM_PATTERN.test(line);
  },
  apply() {
    return {
      matched: true,
      replacement: '',
      newCursor: { line: 0, ch: 0 },
    };
  },
};

const blockquoteDoubleEnterRule: ExitRule = {
  id: 'blockquote-double-enter',
  triggers: ['enter'],
  matches(line, context) {
    if (context.inCodeFence) {
      return false;
    }

    return EMPTY_BLOCKQUOTE_PATTERN.test(line) && /^\s*>/.test(context.previousLineText);
  },
  apply() {
    return {
      matched: true,
      replacement: '',
      newCursor: { line: 0, ch: 0 },
    };
  },
};

const orderedListContinuationRule: ExitRule = {
  id: 'ordered-list-continue',
  triggers: ['enter'],
  matches(_line, context) {
    if (context.inCodeFence) {
      return false;
    }

    return ORDERED_LIST_WITH_CONTENT_PATTERN.test(context.previousLineText);
  },
  apply(_line, context) {
    const match = context.previousLineText.match(ORDERED_LIST_WITH_CONTENT_PATTERN);
    if (!match) {
      return { matched: false };
    }

    const indent = match[1] ?? '';
    const index = Number.parseInt(match[2] ?? '1', 10);
    const nextIndex = Number.isFinite(index) ? index + 1 : 1;

    return {
      matched: true,
      nextLinePrefix: `${indent}${String(nextIndex)}. `,
    };
  },
};

const codeFenceCloseRule: ExitRule = {
  id: 'code-fence-close',
  triggers: ['enter'],
  matches(line, context) {
    return context.inCodeFence && CODE_FENCE_PATTERN.test(line);
  },
  apply() {
    return {
      matched: true,
      nextLinePrefix: '',
    };
  },
};

export const EXIT_RULES: readonly ExitRule[] = [
  emptyListEnterRule,
  blockquoteDoubleEnterRule,
  orderedListContinuationRule,
  codeFenceCloseRule,
] as const;

export function evaluateExitRule(
  line: string,
  context: BlockContext,
  trigger: InputTrigger
): ExitRuleResult {
  for (const rule of EXIT_RULES) {
    if (!rule.triggers.includes(trigger)) {
      continue;
    }

    if (!rule.matches(line, context)) {
      continue;
    }

    const result = rule.apply(line, context);
    if (result.matched) {
      return result;
    }
  }

  return { matched: false };
}
