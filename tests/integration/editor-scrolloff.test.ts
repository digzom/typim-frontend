import { describe, expect, it } from 'vitest';
import { CM6EditorEngine } from '../../src/editor/cm6';
import {
  DEFAULT_SCROLLOFF_MARGIN_PX,
  resolveScrolloffViewportPolicy,
} from '../../src/editor/cm6/extensions/scrolloff';

describe('scrolloff viewport policy integration', () => {
  it('keeps roughly 120px context and clamps at document boundaries', () => {
    const middle = resolveScrolloffViewportPolicy({
      cursorLine: 10,
      totalLines: 100,
      viewportHeight: 700,
      defaultMarginPx: DEFAULT_SCROLLOFF_MARGIN_PX,
    });

    expect(middle.topMarginPx).toBe(120);
    expect(middle.bottomMarginPx).toBe(120);
    expect(middle.clampedAtBoundary).toBe(false);

    const topBoundary = resolveScrolloffViewportPolicy({
      cursorLine: 1,
      totalLines: 100,
      viewportHeight: 700,
      defaultMarginPx: DEFAULT_SCROLLOFF_MARGIN_PX,
    });

    expect(topBoundary.topMarginPx).toBe(0);
    expect(topBoundary.bottomMarginPx).toBe(120);
    expect(topBoundary.clampedAtBoundary).toBe(true);

    const bottomBoundary = resolveScrolloffViewportPolicy({
      cursorLine: 100,
      totalLines: 100,
      viewportHeight: 700,
      defaultMarginPx: DEFAULT_SCROLLOFF_MARGIN_PX,
    });

    expect(bottomBoundary.topMarginPx).toBe(120);
    expect(bottomBoundary.bottomMarginPx).toBe(0);
    expect(bottomBoundary.clampedAtBoundary).toBe(true);
  });

  it('does not increase page-level scroll metrics during cursor movement', () => {
    const container = document.createElement('div');
    container.style.height = '480px';
    document.body.appendChild(container);

    const engine = new CM6EditorEngine();
    engine.initialize(
      container,
      Array.from({ length: 220 }, (_, i) => `line ${String(i + 1)}`).join('\n')
    );

    const initialBodyScrollHeight = document.body.scrollHeight;
    const initialDocumentScrollHeight = document.documentElement.scrollHeight;

    engine.setCursor({ line: 120, ch: 0 });
    engine.setCursor({ line: 180, ch: 0 });
    engine.setCursor({ line: 5, ch: 0 });

    expect(document.body.scrollHeight).toBe(initialBodyScrollHeight);
    expect(document.documentElement.scrollHeight).toBe(initialDocumentScrollHeight);

    engine.destroy();
    container.remove();
  });

  it('covers mixed cursor and scroll interactions with visibility and clamp checks', () => {
    const totalLines = 220;
    const viewportHeight = 480;
    const lineHeight = 20;
    const maxScrollTop = totalLines * lineHeight - viewportHeight;
    let scrollTop = 0;

    const clamp = (value: number): number => Math.max(0, Math.min(maxScrollTop, value));

    const ensureCursorVisible = (cursorLine: number): void => {
      const policy = resolveScrolloffViewportPolicy({
        cursorLine,
        totalLines,
        viewportHeight,
        defaultMarginPx: DEFAULT_SCROLLOFF_MARGIN_PX,
      });
      const cursorTop = (cursorLine - 1) * lineHeight;
      const cursorBottom = cursorTop + lineHeight;

      const visibleTop = scrollTop + policy.topMarginPx;
      const visibleBottom = scrollTop + viewportHeight - policy.bottomMarginPx;

      if (cursorTop < visibleTop) {
        scrollTop = clamp(cursorTop - policy.topMarginPx);
      }

      if (cursorBottom > visibleBottom) {
        scrollTop = clamp(cursorBottom - (viewportHeight - policy.bottomMarginPx));
      }

      const adjustedVisibleTop = scrollTop + policy.topMarginPx;
      const adjustedVisibleBottom = scrollTop + viewportHeight - policy.bottomMarginPx;

      expect(cursorTop).toBeGreaterThanOrEqual(adjustedVisibleTop);
      expect(cursorBottom).toBeLessThanOrEqual(adjustedVisibleBottom);
      expect(scrollTop).toBeGreaterThanOrEqual(0);
      expect(scrollTop).toBeLessThanOrEqual(maxScrollTop);

      if (cursorLine === 1 || cursorLine === totalLines) {
        expect(policy.clampedAtBoundary).toBe(true);
      } else {
        expect(policy.clampedAtBoundary).toBe(false);
      }
    };

    const interactionSequence = [
      { cursorLine: 1, wheelDelta: -200 },
      { cursorLine: 24, wheelDelta: 280 },
      { cursorLine: 96, wheelDelta: 320 },
      { cursorLine: 168, wheelDelta: -180 },
      { cursorLine: totalLines, wheelDelta: 360 },
      { cursorLine: 140, wheelDelta: -240 },
    ];

    for (const interaction of interactionSequence) {
      ensureCursorVisible(interaction.cursorLine);
      scrollTop = clamp(scrollTop + interaction.wheelDelta);
      ensureCursorVisible(interaction.cursorLine);
    }
  });
});
