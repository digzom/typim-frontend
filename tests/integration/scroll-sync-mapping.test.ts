import { describe, expect, it } from 'vitest';
import type {
  CursorPosition,
  EditorEvent,
  IEditorEngine,
  PreviewSourceMap,
  ScrollInfo,
} from '../../src/core/types';
import { ScrollCoordinator } from '../../src/ui/scroll-sync';

class IntegrationEditorStub implements IEditorEngine {
  constructor(
    private top = 0,
    private height = 1400,
    private clientHeight = 400
  ) {}

  getValue(): string {
    return '';
  }
  setValue(_value: string): void {}
  getCursor(): CursorPosition {
    return { line: 0, ch: 0 };
  }
  setCursor(_pos: CursorPosition): void {}
  getScrollInfo(): ScrollInfo {
    return { top: this.top, height: this.height, clientHeight: this.clientHeight };
  }
  scrollTo(top: number): void {
    this.top = top;
  }
  focus(): void {}
  hasFocus(): boolean {
    return true;
  }
  on(_event: EditorEvent, _handler: (...args: unknown[]) => void): () => void {
    return () => undefined;
  }
  off(_event: EditorEvent, _handler: (...args: unknown[]) => void): void {}
  destroy(): void {}
}

function setMetrics(element: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
    writable: true,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: clientHeight,
    writable: true,
  });
}

describe('scroll sync mapping integration', () => {
  it('prefers source-map target resolution when anchors exist', () => {
    const editor = new IntegrationEditorStub();
    const preview = document.createElement('div');
    setMetrics(preview, 2200, 500);

    const sourceMap: PreviewSourceMap = {
      mapVersion: 3,
      totalLines: 120,
      anchors: [
        { lineStart: 1, lineEnd: 30, elementId: 'a-1', offsetTop: 0 },
        { lineStart: 31, lineEnd: 60, elementId: 'a-2', offsetTop: 260 },
        { lineStart: 61, lineEnd: 90, elementId: 'a-3', offsetTop: 620 },
      ],
    };

    const coordinator = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => sourceMap,
    });

    const result = coordinator.sync({
      source: 'editor',
      scrollTop: 500,
      scrollHeight: 1400,
      clientHeight: 400,
    });

    expect(result.synced).toBe(true);
    expect(result.mode).toBe('source-map');
    expect(result.targetScrollTop).toBe(620);
  });

  it('uses deterministic ratio fallback metadata for missing/invalid maps', () => {
    const editor = new IntegrationEditorStub();
    const preview = document.createElement('div');
    setMetrics(preview, 1800, 400);

    const coordinatorMissing = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => null,
    });

    const missingMapResult = coordinatorMissing.sync({
      source: 'editor',
      scrollTop: 300,
      scrollHeight: 1000,
      clientHeight: 200,
    });

    expect(missingMapResult.mode).toBe('ratio-fallback');
    expect(missingMapResult.fallbackReason).toBe('missing-map');

    const coordinatorInvalid = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => ({
        mapVersion: 2,
        totalLines: 40,
        anchors: [{ lineStart: 30, lineEnd: 80, elementId: 'bad', offsetTop: 10 }],
      }),
    });

    const invalidMapResult = coordinatorInvalid.sync({
      source: 'preview',
      scrollTop: 250,
      scrollHeight: 1800,
      clientHeight: 400,
    });

    expect(invalidMapResult.mode).toBe('ratio-fallback');
    expect(invalidMapResult.fallbackReason).toBe('stale-map');
  });

  it('keeps sync disabled in single-pane live-markdown mode predicate', () => {
    const editor = new IntegrationEditorStub();
    const preview = document.createElement('div');
    setMetrics(preview, 1800, 400);

    let allowSync = false;
    const coordinator = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => allowSync,
      getSourceMap: () => null,
    });

    const blocked = coordinator.sync({
      source: 'editor',
      scrollTop: 200,
      scrollHeight: 1200,
      clientHeight: 300,
    });

    expect(blocked.synced).toBe(false);
    expect(blocked.targetScrollTop).toBe(200);

    allowSync = true;
    const allowed = coordinator.sync({
      source: 'editor',
      scrollTop: 200,
      scrollHeight: 1200,
      clientHeight: 300,
    });

    expect(allowed.synced).toBe(true);
    expect(allowed.mode).toBe('ratio-fallback');
    expect(allowed.fallbackReason).toBe('missing-map');
  });
});
