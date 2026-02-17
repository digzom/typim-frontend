import { CONFIG, STORAGE_KEYS } from '../../core/config';
import type { StateManager } from '../../core/state';
import type { IThemeManager, Theme } from '../../core/types';
import type { StorageAdapter } from '../../utils/storage';

type EffectiveTheme = 'light' | 'dark';

export class ThemeManager implements IThemeManager {
  private theme: Theme;
  private unsubscribeState: (() => void) | null = null;

  private readonly systemThemeListener = (): void => {
    if (this.theme === 'system') {
      this.apply(this.theme);
    }
  };

  constructor(
    private readonly stateManager: StateManager,
    private readonly storage: StorageAdapter
  ) {
    this.theme = this.stateManager.getState().ui.theme;

    this.unsubscribeState = this.stateManager.subscribe((newState, prevState) => {
      if (newState.ui.theme === prevState.ui.theme) {
        return;
      }
      this.apply(newState.ui.theme);
    });

    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', this.systemThemeListener);
    }
  }

  apply(theme: Theme): { applied: boolean; effectiveTheme: EffectiveTheme } {
    this.theme = theme;
    const effectiveTheme = this.resolveEffectiveTheme(theme);

    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-theme', effectiveTheme);

      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', effectiveTheme === 'dark' ? '#1f1f1f' : '#f2f2f2');
      }
    }

    this.storage.set(STORAGE_KEYS.THEME, theme, CONFIG.storageVersion);

    return {
      applied: true,
      effectiveTheme,
    };
  }

  getTheme(): Theme {
    return this.theme;
  }

  destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }

    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', this.systemThemeListener);
    }
  }

  private resolveEffectiveTheme(theme: Theme): EffectiveTheme {
    if (theme === 'dark') {
      return 'dark';
    }

    if (theme === 'light') {
      return 'light';
    }

    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  }
}
