import type { CursorPosition } from '../../core/types';

export type InputTrigger = 'space' | 'enter' | 'backspace' | 'paste';

export interface BlockContext {
  lineNumber: number;
  column: number;
  inCodeFence: boolean;
  inBlockquote: boolean;
  listDepth: number;
  previousLineText: string;
  vimMode: boolean;
}

export interface TransformRuleResult {
  transformed: boolean;
  replacement?: string;
  newCursor?: CursorPosition;
  toggleCodeFence?: boolean;
}

export interface TransformRule {
  id:
    | 'code-fence'
    | 'horizontal-rule'
    | 'heading'
    | 'ordered-list'
    | 'unordered-list'
    | 'blockquote';
  precedence: number;
  triggers: InputTrigger[];
  matches(line: string, cursor: CursorPosition, context: BlockContext): boolean;
  apply(line: string, cursor: CursorPosition, context: BlockContext): TransformRuleResult;
}

export interface ExitRuleResult {
  matched: boolean;
  replacement?: string;
  nextLinePrefix?: string;
  clearPreviousLine?: boolean;
  newCursor?: CursorPosition;
}

export interface ExitRule {
  id: 'empty-list-enter' | 'blockquote-double-enter' | 'ordered-list-continue' | 'code-fence-close';
  triggers: InputTrigger[];
  matches(line: string, context: BlockContext): boolean;
  apply(line: string, context: BlockContext): ExitRuleResult;
}

// Precedence is deterministic: code fence > hr > heading > list > quote.
export const RULE_PRECEDENCE = [
  'code-fence',
  'horizontal-rule',
  'heading',
  'ordered-list',
  'unordered-list',
  'blockquote',
] as const;
