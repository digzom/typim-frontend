import { EDITOR_CONSTANTS } from '../../core/config';
import type { StateManager } from '../../core/state';
import type { ILayoutManager, LayoutMode } from '../../core/types';

const LAYOUT_CLASSES: LayoutMode[] = ['split', 'single', 'focus', 'mobile'];

export class LayoutManager implements ILayoutManager {
  private mode: LayoutMode;
  private mobilePane: 'editor' | 'preview';
  private splitRatio: number;
  private readonly mediaQuery: MediaQueryList;
  private readonly mediaQueryListener: (event: MediaQueryListEvent) => void;
  private unsubscribeState: (() => void) | null = null;

  constructor(private readonly stateManager: StateManager) {
    const initialState = stateManager.getState();

    this.mode = initialState.ui.layout;
    this.mobilePane = initialState.ui.mobilePane;
    this.splitRatio = initialState.ui.splitRatio;
    this.mediaQuery = window.matchMedia(
      `(max-width: ${String(EDITOR_CONSTANTS.MOBILE_BREAKPOINT)}px)`
    );
    this.mediaQueryListener = event => this.handleViewportChange(event.matches);

    this.mediaQuery.addEventListener('change', this.mediaQueryListener);

    this.unsubscribeState = this.stateManager.subscribe((newState, prevState) => {
      if (newState.ui.layout !== prevState.ui.layout && newState.ui.layout !== this.mode) {
        this.mode = newState.ui.layout;
        this.applyMode(this.mode);
      }

      if (
        newState.ui.splitRatio !== prevState.ui.splitRatio &&
        newState.ui.splitRatio !== this.splitRatio
      ) {
        this.splitRatio = newState.ui.splitRatio;
        this.applySplitRatio(this.splitRatio);
      }

      if (
        newState.ui.mobilePane !== prevState.ui.mobilePane &&
        newState.ui.mobilePane !== this.mobilePane
      ) {
        this.mobilePane = newState.ui.mobilePane;
        this.applyMode(this.mode);
      }
    });

    this.handleViewportChange(this.mediaQuery.matches);
    this.applyMode(this.mode);
    this.applySplitRatio(this.splitRatio);
  }

  setMode(mode: LayoutMode): boolean {
    const effectiveMode = this.isMobile() ? 'mobile' : mode;
    if (this.mode === effectiveMode) {
      return false;
    }

    this.mode = effectiveMode;
    this.applyMode(effectiveMode);

    if (this.stateManager.getState().ui.layout !== effectiveMode) {
      this.stateManager.dispatch({ type: 'UI_SET_LAYOUT', payload: effectiveMode });
    }

    return true;
  }

  getMode(): LayoutMode {
    return this.mode;
  }

  setSplitRatio(ratio: number): void {
    const clampedRatio = Math.min(0.7, Math.max(0.3, ratio));
    this.splitRatio = clampedRatio;
    this.applySplitRatio(clampedRatio);

    if (this.stateManager.getState().ui.splitRatio !== clampedRatio) {
      this.stateManager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: clampedRatio });
    }
  }

  getSplitRatio(): number {
    return this.splitRatio;
  }

  isMobile(): boolean {
    return this.mediaQuery.matches;
  }

  destroy(): void {
    this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
  }

  private handleViewportChange(isMobileViewport: boolean): void {
    if (isMobileViewport) {
      this.setMode('mobile');
      return;
    }

    if (this.mode === 'mobile') {
      const preferred = this.stateManager.getState().ui.layout;
      this.setMode(preferred === 'mobile' ? 'split' : preferred);
    }
  }

  private applyMode(mode: LayoutMode): void {
    const body = document.body;

    for (const classMode of LAYOUT_CLASSES) {
      body.classList.remove(`layout--${classMode}`);
    }
    body.classList.add(`layout--${mode}`);

    if (mode === 'mobile') {
      body.setAttribute('data-layout', 'mobile');
      body.setAttribute('data-mobile-pane', this.mobilePane);

      if (this.mobilePane === 'preview') {
        body.classList.add('mobile-preview');
      } else {
        body.classList.remove('mobile-preview');
      }

      return;
    }

    body.classList.remove('mobile-preview');
    body.removeAttribute('data-mobile-pane');
    body.setAttribute('data-layout', mode);
  }

  private applySplitRatio(ratio: number): void {
    const workspace = document.querySelector<HTMLElement>('.workspace');
    if (!workspace) {
      return;
    }

    workspace.style.setProperty('--split-ratio', String(ratio));
  }
}
