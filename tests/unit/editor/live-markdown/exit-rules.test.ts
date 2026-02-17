import { describe, expect, it } from 'vitest';
import { evaluateExitRule } from '../../../../src/editor/live-markdown/exit-rules';
import type { BlockContext } from '../../../../src/editor/live-markdown/types';

function context(overrides: Partial<BlockContext> = {}): BlockContext {
  return {
    lineNumber: 0,
    column: 0,
    inCodeFence: false,
    inBlockquote: false,
    listDepth: 0,
    previousLineText: '',
    vimMode: false,
    ...overrides,
  };
}

describe('live markdown exit rules', () => {
  it('removes empty list marker on enter', () => {
    const result = evaluateExitRule('- ', context(), 'enter');

    expect(result.matched).toBe(true);
    expect(result.replacement).toBe('');
  });

  it('exits blockquote on double enter', () => {
    const result = evaluateExitRule(
      '> ',
      context({
        previousLineText: '> quoted text',
      }),
      'enter'
    );

    expect(result.matched).toBe(true);
    expect(result.replacement).toBe('');
  });

  it('continues ordered list with incremented index', () => {
    const result = evaluateExitRule(
      '',
      context({
        previousLineText: '2. second item',
      }),
      'enter'
    );

    expect(result.matched).toBe(true);
    expect(result.nextLinePrefix).toBe('3. ');
  });

  it('does not apply list exits while inside code fence', () => {
    const result = evaluateExitRule(
      '- ',
      context({
        inCodeFence: true,
      }),
      'enter'
    );

    expect(result.matched).toBe(false);
  });
});
