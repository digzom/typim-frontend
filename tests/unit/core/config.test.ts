import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfigWithUrl(url: string) {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  return import('../../../src/core/config');
}

async function loadConfigWithoutWindow() {
  const currentWindow = globalThis.window;
  vi.stubGlobal('window', undefined);
  vi.resetModules();

  try {
    return await import('../../../src/core/config');
  } finally {
    vi.unstubAllGlobals();
    vi.stubGlobal('window', currentWindow);
  }
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('core config feature flags', () => {
  it("isFeatureEnabled('useFenceHighlighting') returns configured value", async () => {
    const enabledConfig = await loadConfigWithUrl('/?fence=true');
    expect(enabledConfig.isFeatureEnabled('useFenceHighlighting')).toBe(true);

    const disabledConfig = await loadConfigWithUrl('/?fence=false');
    expect(disabledConfig.isFeatureEnabled('useFenceHighlighting')).toBe(false);
  });

  it('applies URL override for fence highlighting in development only', async () => {
    const developmentConfig = await loadConfigWithUrl('/?fence=true&livemd=false');
    expect(developmentConfig.CONFIG.features.useFenceHighlighting).toBe(true);
    expect(developmentConfig.CONFIG.features.useLiveMarkdown).toBe(false);

    const productionConfig = await loadConfigWithoutWindow();
    expect(productionConfig.CONFIG.environment).toBe('production');
    expect(productionConfig.CONFIG.features.useFenceHighlighting).toBe(false);
  });
});
