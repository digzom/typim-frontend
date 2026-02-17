import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CursorPosition,
  EditorEvent,
  IEditorEngine,
  PreviewSourceMap,
  ScrollInfo,
} from '../../../src/core/types';
import { ScrollCoordinator } from '../../../src/ui/scroll-sync';

class FakeEditor implements IEditorEngine {
  private scrollTop = 0;
  private scrollHeight = 1000;
  private clientHeight = 200;
  private readonly handlers: Record<EditorEvent, Set<(...args: unknown[]) => void>> = {
    change: new Set(),
    scroll: new Set(),
    focus: new Set(),
    blur: new Set(),
    cursorActivity: new Set(),
  };

  getValue(): string {
    return '';
  }

  setValue(_value: string): void {}

  getCursor(): CursorPosition {
    return { line: 0, ch: 0 };
  }

  setCursor(_pos: CursorPosition): void {}

  getScrollInfo(): ScrollInfo {
    return {
      top: this.scrollTop,
      height: this.scrollHeight,
      clientHeight: this.clientHeight,
    };
  }

  scrollTo(top: number): void {
    this.scrollTop = top;
  }

  focus(): void {}

  hasFocus(): boolean {
    return true;
  }

  on(event: EditorEvent, handler: (...args: unknown[]) => void): () => void {
    this.handlers[event].add(handler);
    return () => {
      this.handlers[event].delete(handler);
    };
  }

  off(event: EditorEvent, handler: (...args: unknown[]) => void): void {
    this.handlers[event].delete(handler);
  }

  destroy(): void {
    for (const set of Object.values(this.handlers)) {
      set.clear();
    }
  }

  emit(event: EditorEvent, payload?: unknown): void {
    for (const handler of this.handlers[event]) {
      handler(payload);
    }
  }

  setScrollMetrics(top: number, height: number, clientHeight: number): void {
    this.scrollTop = top;
    this.scrollHeight = height;
    this.clientHeight = clientHeight;
  }
}

function setElementMetrics(element: HTMLElement, scrollHeight: number, clientHeight: number): void {
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

function createSourceMap(): PreviewSourceMap {
  return {
    mapVersion: 1,
    totalLines: 100,
    anchors: [
      { lineStart: 1, lineEnd: 20, elementId: 'a-1', offsetTop: 0 },
      { lineStart: 21, lineEnd: 40, elementId: 'a-2', offsetTop: 160 },
      { lineStart: 41, lineEnd: 60, elementId: 'a-3', offsetTop: 320 },
      { lineStart: 61, lineEnd: 80, elementId: 'a-4', offsetTop: 480 },
      { lineStart: 81, lineEnd: 100, elementId: 'a-5', offsetTop: 640 },
    ],
  };
}

describe('ScrollCoordinator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves using source map before ratio fallback', () => {
    const editor = new FakeEditor();
    const preview = document.createElement('div');
    setElementMetrics(preview, 1000, 200);

    const coordinator = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => createSourceMap(),
    });

    const result = coordinator.sync({
      source: 'editor',
      scrollTop: 200,
      scrollHeight: 800,
      clientHeight: 200,
    });
    const repeat = coordinator.sync({
      source: 'editor',
      scrollTop: 200,
      scrollHeight: 800,
      clientHeight: 200,
    });

    expect(result.synced).toBe(true);
    expect(result.mode).toBe('source-map');
    // Interpolates within matched anchor range, not just anchor top.
    expect(result.targetScrollTop).toBeCloseTo(264, 5);
    expect(repeat).toEqual(result);
  });

  it('falls back to ratio mode when source map is missing', () => {
    const editor = new FakeEditor();
    const preview = document.createElement('div');
    setElementMetrics(preview, 1000, 200);

    const coordinator = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => null,
    });

    const result = coordinator.sync({
      source: 'editor',
      scrollTop: 100,
      scrollHeight: 500,
      clientHeight: 100,
    });

    expect(result.mode).toBe('ratio-fallback');
    expect(result.fallbackReason).toBe('missing-map');
    expect(result.targetScrollTop).toBeCloseTo(200, 5);
  });

  it('falls back when source map ranges are invalid', () => {
    const editor = new FakeEditor();
    const preview = document.createElement('div');
    setElementMetrics(preview, 900, 300);

    const coordinator = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => ({
        mapVersion: 1,
        totalLines: 20,
        anchors: [{ lineStart: 18, lineEnd: 30, elementId: 'bad', offsetTop: 50 }],
      }),
    });

    const result = coordinator.sync({
      source: 'preview',
      scrollTop: 60,
      scrollHeight: 600,
      clientHeight: 200,
    });

    expect(result.mode).toBe('ratio-fallback');
    expect(result.fallbackReason).toBe('stale-map');
  });

  it('prevents ping-pong recursion and releases guard deterministically frame-by-frame', () => {
    const editor = new FakeEditor();
    editor.setScrollMetrics(0, 2000, 400);
    const preview = document.createElement('div');
    setElementMetrics(preview, 2200, 500);

    let nextFrameId = 1;
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      scheduledFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(frameId => {
      scheduledFrames.delete(frameId);
    });
    const editorScrollToSpy = vi.spyOn(editor, 'scrollTo');

    const coordinator = new ScrollCoordinator(editor, preview, {
      isSyncAllowed: () => true,
      getSourceMap: () => createSourceMap(),
    });

    coordinator.attach();

    const internals = coordinator as unknown as { pendingFrame: number | null };

    const flushNextFrame = (): void => {
      const nextFrame = scheduledFrames.entries().next();
      expect(nextFrame.done).toBe(false);
      const [frameId, callback] = nextFrame.value as [number, FrameRequestCallback];
      scheduledFrames.delete(frameId);
      callback(performance.now());
    };

    for (let frame = 0; frame < 120; frame += 1) {
      const callsBeforeFrame = editorScrollToSpy.mock.calls.length;

      editor.setScrollMetrics(frame * 8, 2000, 400);
      editor.emit('scroll');
      const callsAfterEditorEvent = editorScrollToSpy.mock.calls.length;

      expect(scheduledFrames.size).toBe(1);
      expect(internals.pendingFrame).not.toBeNull();
      expect(callsAfterEditorEvent - callsBeforeFrame).toBeLessThanOrEqual(1);

      preview.scrollTop = frame * 5;
      preview.dispatchEvent(new Event('scroll'));
      expect(editorScrollToSpy.mock.calls.length).toBeLessThanOrEqual(callsAfterEditorEvent + 1);
      expect(scheduledFrames.size).toBe(1);

      preview.scrollTop = frame * 5;
      preview.dispatchEvent(new Event('scroll'));
      expect(editorScrollToSpy.mock.calls.length).toBeLessThanOrEqual(callsAfterEditorEvent + 2);
      expect(scheduledFrames.size).toBe(1);

      flushNextFrame();
      expect(scheduledFrames.size).toBe(0);
      expect(internals.pendingFrame).toBeNull();
    }

    expect(Number.isFinite(preview.scrollTop)).toBe(true);
    expect(rafSpy).toHaveBeenCalled();
    expect(editorScrollToSpy.mock.calls.length).toBeLessThanOrEqual(360);

    coordinator.destroy();
  });
});
