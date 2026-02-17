import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cm5InitializeSpy = vi.hoisted(() => vi.fn());
const cm5OnSpy = vi.hoisted(() => vi.fn());
const ensureCM5LoadedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const fenceRegistryTouched = vi.hoisted(() => ({ value: false }));

vi.mock('../../src/editor/cm5-adapter', () => {
  class MockCM5EditorEngine {
    initialize = cm5InitializeSpy;

    on = cm5OnSpy;

    getValue(): string {
      return '';
    }

    getCursor(): { line: number; ch: number } {
      return { line: 0, ch: 0 };
    }

    setValue(): void {}

    setCursor(): void {}

    hasFocus(): boolean {
      return false;
    }

    destroy(): void {}
  }

  return {
    CM5EditorEngine: MockCM5EditorEngine,
    ensureCM5Loaded: ensureCM5LoadedSpy,
  };
});

vi.mock('../../src/ui/preview', () => ({
  createPreviewRenderer: () => ({
    render: () => {},
    getSourceMap: () => null,
  }),
}));

vi.mock('../../src/ui/scroll-sync', () => ({
  ScrollCoordinator: class {
    attach(): void {}

    destroy(): void {}
  },
}));

vi.mock('../../src/editor/cm6/extensions/fence-language-registry', () => {
  fenceRegistryTouched.value = true;

  return {
    cm6FenceLanguageRegistry: {
      resolveCodeLanguage: () => null,
    },
  };
});

function mountRequiredAppShell(): void {
  document.body.innerHTML = `
    <div id="editor"></div>
    <div id="preview"></div>
    <button id="menu-btn"></button>
    <div id="action-menu">
      <button id="menu-open" class="menu-item"></button>
      <button id="menu-save" class="menu-item"></button>
      <button id="menu-split" class="menu-item"></button>
      <button id="menu-vim" class="menu-item"></button>
      <button id="menu-livemd" class="menu-item"></button>
      <button id="menu-theme" class="menu-item"></button>
      <button id="menu-fonts" class="menu-item"></button>
      <button id="menu-shortcuts" class="menu-item"></button>
      <button id="menu-share" class="menu-item"></button>
    </div>
    <input id="doc-title" />
    <div id="share-modal"></div>
    <div id="font-modal"></div>
    <div id="shortcuts-modal"></div>
    <button id="share-create"></button>
    <button id="share-update"></button>
    <select id="share-type"><option value="static">static</option></select>
    <select id="share-privacy"><option value="public">public</option></select>
    <input id="share-url" />
    <button id="share-copy"></button>
    <div id="share-error"></div>
    <button id="share-close"></button>
    <button id="font-close"></button>
    <button id="shortcuts-close"></button>
  `;
}

beforeEach(() => {
  vi.resetModules();
  cm5InitializeSpy.mockClear();
  cm5OnSpy.mockClear();
  ensureCM5LoadedSpy.mockClear();
  fenceRegistryTouched.value = false;
  window.history.replaceState({}, '', '/?cm6=false&fence=true&livemd=false');
  mountRequiredAppShell();
});

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('editor engine fallback compatibility', () => {
  it('AT-COMP-002: cm5 fallback path is selected when cm6 is disabled', async () => {
    const main = await import('../../src/main');

    expect(main.resolveFenceHighlightGate(false, true, false)).toEqual({
      attachFenceHighlighting: false,
      reason: 'cm5-engine',
    });
  });

  it('AT-COMP-002: app initialization with cm6=false does not touch fence registry module', async () => {
    await import('../../src/main');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();
    await Promise.resolve();

    expect(ensureCM5LoadedSpy.mock.calls.length).toBeGreaterThan(0);
    expect(cm5InitializeSpy.mock.calls.length).toBeGreaterThan(0);
    expect(fenceRegistryTouched.value).toBe(false);
  });
});
