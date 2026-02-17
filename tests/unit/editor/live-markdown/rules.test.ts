import { describe, expect, it } from 'vitest';
import {
  deriveBlockContextFromLines,
  findTransformRule,
  isAmbiguousRawPattern,
} from '../../../../src/editor/live-markdown/rules';

describe('live markdown transform rules', () => {
  it('normalizes heading input spacing', () => {
    const line = '#  title';
    const context = deriveBlockContextFromLines([line], 0, line.length);

    const result = findTransformRule(line, { line: 0, ch: line.length }, context, 'space');

    expect(result?.result.transformed).toBe(true);
    expect(result?.result.replacement).toBe('# title');
  });

  it('normalizes unordered list spacing', () => {
    const line = '-  item';
    const context = deriveBlockContextFromLines([line], 0, line.length);

    const result = findTransformRule(line, { line: 0, ch: line.length }, context, 'space');

    expect(result?.result.transformed).toBe(true);
    expect(result?.result.replacement).toBe('- item');
  });

  it('guards ambiguous raw marker patterns', () => {
    expect(isAmbiguousRawPattern('#topic')).toBe(true);

    const line = '#topic';
    const context = deriveBlockContextFromLines([line], 0, line.length);
    const result = findTransformRule(line, { line: 0, ch: line.length }, context, 'space');

    expect(result).toBeNull();
  });

  it('marks code fence transformations', () => {
    const line = '```ts  ';
    const context = deriveBlockContextFromLines([line], 0, line.length);

    const result = findTransformRule(line, { line: 0, ch: line.length }, context, 'space');

    expect(result?.result.transformed).toBe(true);
    expect(result?.result.toggleCodeFence).toBe(true);
    expect(result?.result.replacement).toBe('```ts');
  });

  it('treats tilde fences as code-fence delimiters', () => {
    const fenceLine = '~~~ts  ';
    const fenceContext = deriveBlockContextFromLines([fenceLine], 0, fenceLine.length);
    const fenceResult = findTransformRule(
      fenceLine,
      { line: 0, ch: fenceLine.length },
      fenceContext,
      'space'
    );

    expect(fenceResult?.result.transformed).toBe(true);
    expect(fenceResult?.result.toggleCodeFence).toBe(true);
    expect(fenceResult?.result.replacement).toBe('~~~ts');

    const lines = ['~~~ts', '#  heading'];
    const insideFenceContext = deriveBlockContextFromLines(lines, 1, lines[1].length);
    const headingInsideFence = findTransformRule(
      lines[1],
      { line: 1, ch: lines[1].length },
      insideFenceContext,
      'space'
    );

    expect(insideFenceContext.inCodeFence).toBe(true);
    expect(headingInsideFence).toBeNull();
  });
});
