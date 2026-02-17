import { CONFIG, FONT_FAMILIES, STORAGE_KEYS } from '../../core/config';
import type { StateManager } from '../../core/state';
import type { BodyFont, FontToken, ITypographySystem, MonoFont } from '../../core/types';
import type { StorageAdapter } from '../../utils/storage';

const BODY_FONT_TOKENS: Record<BodyFont, FontToken> = {
  serif: {
    family: 'Source Serif 4',
    fallback: 'Iowan Old Style, Georgia, serif',
    display: 'swap',
  },
  sans: {
    family: 'Source Sans 3',
    fallback: 'Noto Sans, Helvetica Neue, sans-serif',
    display: 'swap',
  },
};

const MONO_FONT_TOKENS: Record<MonoFont, FontToken> = {
  plex: {
    family: 'Source Code Pro',
    fallback: 'IBM Plex Mono, Menlo, Consolas, monospace',
    display: 'swap',
  },
  system: {
    family: 'ui-monospace',
    fallback: 'SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace',
    display: 'swap',
  },
};

export class TypographySystem implements ITypographySystem {
  private unsubscribeState: (() => void) | null = null;

  constructor(
    private readonly stateManager: StateManager,
    private readonly storage: StorageAdapter
  ) {}

  initialize(): void {
    const state = this.stateManager.getState();
    this.applyBodySelection(state.fonts.body);
    this.applyMonoSelection(state.fonts.mono);

    this.unsubscribeState = this.stateManager.subscribe((newState, prevState) => {
      if (newState.fonts.body !== prevState.fonts.body) {
        this.applyBodySelection(newState.fonts.body);
      }

      if (newState.fonts.mono !== prevState.fonts.mono) {
        this.applyMonoSelection(newState.fonts.mono);
      }
    });
  }

  loadFont(token: FontToken): Promise<boolean> {
    if (!('fonts' in document)) {
      return Promise.resolve(false);
    }

    // Browser already handles linked web fonts from index.html.
    return Promise.resolve(document.fonts.check(`16px "${token.family}"`));
  }

  applyFont(element: HTMLElement, font: FontToken): void {
    element.style.fontFamily = `"${font.family}", ${font.fallback}`;
  }

  setBodyFont(font: FontToken): void {
    document.documentElement.style.setProperty('--font-body', `"${font.family}", ${font.fallback}`);
  }

  setMonoFont(font: FontToken): void {
    document.documentElement.style.setProperty('--font-mono', `"${font.family}", ${font.fallback}`);
  }

  destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
  }

  private applyBodySelection(selection: BodyFont): void {
    const token = BODY_FONT_TOKENS[selection] ?? BODY_FONT_TOKENS.serif;

    this.setBodyFont(token);
    this.storage.set(`${STORAGE_KEYS.FONTS}:body`, selection, CONFIG.storageVersion);

    // Keep CSS tokens aligned with existing config constants.
    document.documentElement.style.setProperty('--font-body', FONT_FAMILIES.body[selection]);
  }

  private applyMonoSelection(selection: MonoFont): void {
    const token = MONO_FONT_TOKENS[selection] ?? MONO_FONT_TOKENS.plex;

    this.setMonoFont(token);
    this.storage.set(`${STORAGE_KEYS.FONTS}:mono`, selection, CONFIG.storageVersion);

    document.documentElement.style.setProperty('--font-mono', FONT_FAMILIES.mono[selection]);
  }
}
