import type { LanguageSupport } from '@codemirror/language';
import { describe, expect, it, vi } from 'vitest';
import { createCm6FenceLanguageRegistry } from '../../../../src/editor/cm6/extensions/fence-language-registry';

function createSupportStub(name: string): LanguageSupport {
  return { language: { name } } as unknown as LanguageSupport;
}

describe('Cm6FenceLanguageRegistryV1', () => {
  it('maps aliases to canonical ids and resolves unknown names safely', async () => {
    const javascriptSupport = createSupportStub('javascript');
    const goSupport = createSupportStub('go');
    const registry = createCm6FenceLanguageRegistry({
      loaders: {
        javascript: vi.fn(async () => javascriptSupport),
        go: vi.fn(async () => goSupport),
      },
    });

    const jsAlias = await registry.resolveFenceLanguage({ fenceName: 'js' });
    const jsCanonical = await registry.resolveFenceLanguage({ fenceName: 'javascript' });
    const goAlias = await registry.resolveFenceLanguage({ fenceName: 'golang' });
    const unknown = await registry.resolveFenceLanguage({ fenceName: 'unknown' });

    expect(jsAlias.languageId).toBe('javascript');
    expect(jsCanonical.languageId).toBe('javascript');
    expect(goAlias.languageId).toBe('go');
    expect(unknown).toEqual({
      languageId: null,
      aliasMatched: null,
      support: null,
      loadState: 'fallback',
    });
  });

  it('AT-IDEMP-001: returns stable canonical id and support identity on repeated resolution', async () => {
    const support = createSupportStub('javascript');
    const loader = vi.fn(async () => support);
    const registry = createCm6FenceLanguageRegistry({
      loaders: {
        javascript: loader,
      },
    });

    const first = await registry.resolveFenceLanguage({ fenceName: 'js' });
    const second = await registry.resolveFenceLanguage({ fenceName: 'javascript' });

    expect(first.languageId).toBe('javascript');
    expect(second.languageId).toBe('javascript');
    expect(first.support).toBe(support);
    expect(second.support).toBe(support);
    expect(first.loadState).toBe('lazy');
    expect(second.loadState).toBe('eager');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('AT-CONC-001: de-duplicates concurrent loads by canonical id', async () => {
    const support = createSupportStub('python');
    const loadSignal: { resolve: ((value: LanguageSupport) => void) | null } = { resolve: null };
    const loader = vi.fn(
      () =>
        new Promise<LanguageSupport>(resolve => {
          loadSignal.resolve = resolve;
        })
    );

    const registry = createCm6FenceLanguageRegistry({
      loaders: {
        python: loader,
      },
    });

    const first = registry.resolveFenceLanguage({ fenceName: 'python' });
    const second = registry.resolveFenceLanguage({ fenceName: 'py' });

    expect(loader).toHaveBeenCalledTimes(1);

    if (!loadSignal.resolve) {
      throw new Error('Loader did not start');
    }

    loadSignal.resolve(support);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.support).toBe(support);
    expect(secondResult.support).toBe(support);
    expect(firstResult.languageId).toBe('python');
    expect(secondResult.languageId).toBe('python');
  });
});
