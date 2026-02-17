import type {
  BlockContext as CoreBlockContext,
  CursorPosition,
  ExitRule,
  ILiveMarkdownEngine,
  InputTrigger,
  TransformResult,
} from '../../core/types';
import { evaluateExitRule } from './exit-rules';
import { findTransformRule } from './rules';
import type { BlockContext } from './types';

interface LiveMarkdownEngineOptions {
  now?: () => number;
  maxLatencyMs?: number;
}

export class LiveMarkdownEngine implements ILiveMarkdownEngine {
  private readonly now: () => number;
  private readonly maxLatencyMs: number;
  private lastLatencyMs = 0;

  constructor(options: LiveMarkdownEngineOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.maxLatencyMs = options.maxLatencyMs ?? 16;
  }

  processInput(
    line: string,
    cursor: CursorPosition,
    trigger: InputTrigger,
    context: CoreBlockContext
  ): TransformResult {
    const start = this.now();
    const normalizedContext = this.normalizeContext(cursor, context);

    if (normalizedContext.vimMode) {
      return this.finalize({ transformed: false }, start);
    }

    const transformMatch = findTransformRule(line, cursor, normalizedContext, trigger);
    if (transformMatch) {
      const nextCursor = transformMatch.result.newCursor
        ? {
            line: cursor.line,
            ch: transformMatch.result.newCursor.ch,
          }
        : undefined;

      return this.finalize(
        {
          transformed: true,
          replacement: transformMatch.result.replacement,
          newCursor: nextCursor,
        },
        start
      );
    }

    const exitResult = evaluateExitRule(line, normalizedContext, trigger);
    if (exitResult.matched) {
      const mappedExitRules: ExitRule[] = this.mapExitRules(exitResult);

      const replacement =
        exitResult.replacement ??
        (exitResult.nextLinePrefix !== undefined
          ? `${line}${exitResult.nextLinePrefix}`
          : undefined);

      return this.finalize(
        {
          transformed: replacement !== undefined,
          replacement,
          newCursor: exitResult.newCursor,
          exitRules: mappedExitRules,
        },
        start
      );
    }

    return this.finalize({ transformed: false }, start);
  }

  getLastLatencyMs(): number {
    return this.lastLatencyMs;
  }

  private finalize(result: TransformResult, start: number): TransformResult {
    this.lastLatencyMs = this.now() - start;
    if (this.lastLatencyMs > this.maxLatencyMs) {
      console.warn('[LiveMarkdownEngine] processing exceeded latency budget', {
        latencyMs: this.lastLatencyMs,
        budgetMs: this.maxLatencyMs,
      });
    }
    return result;
  }

  private normalizeContext(cursor: CursorPosition, context: CoreBlockContext): BlockContext {
    return {
      lineNumber: context.lineNumber ?? cursor.line,
      column: context.column ?? cursor.ch,
      inCodeFence: context.inCodeFence,
      inBlockquote: context.inQuote,
      listDepth: context.listDepth,
      previousLineText: context.previousLineText ?? '',
      vimMode: context.vimMode ?? false,
    };
  }

  private mapExitRules(result: { replacement?: string; nextLinePrefix?: string }): ExitRule[] {
    if (result.replacement === '') {
      return [{ condition: 'empty-line', action: 'remove-bullet' }];
    }

    if (result.nextLinePrefix !== undefined && /^\d+\.\s/.test(result.nextLinePrefix.trim())) {
      return [{ condition: 'double-enter', action: 'deindent' }];
    }

    return [{ condition: 'double-enter', action: 'exit-block' }];
  }
}
