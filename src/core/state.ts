/**
 * StateManager - Centralized application state with immutable updates
 * Implements IStateManager interface with Redux-like reducer pattern
 * @module core/state
 */

import type {
  AppState,
  StateAction,
  BodyFont,
  MonoFont,
  Theme,
  DispatchResultCompat,
  DispatchResult,
  DispatchError,
} from './types';
import type { StorageAdapter } from '../utils/storage';
import type { EventBus } from './event-bus';
import { CONFIG, STORAGE_KEYS, EDITOR_CONSTANTS } from './config';

/**
 * Initial application state
 */
export const INITIAL_STATE: AppState = {
  editor: {
    content: EDITOR_CONSTANTS.STARTER_CONTENT,
    title: EDITOR_CONSTANTS.DEFAULT_TITLE,
    vimMode: false,
    liveMarkdown: false,
  },
  ui: {
    theme: 'light',
    layout: 'split',
    mobilePane: 'editor',
    splitRatio: 0.5,
    menuOpen: false,
    activeModal: null,
  },
  fonts: {
    body: 'serif',
    mono: 'plex',
  },
  share: {
    id: null,
    url: '',
    type: 'static',
    privacy: 'secret',
  },
};

function cloneInitialState(): AppState {
  return {
    editor: { ...INITIAL_STATE.editor },
    ui: { ...INITIAL_STATE.ui },
    fonts: { ...INITIAL_STATE.fonts },
    share: { ...INITIAL_STATE.share },
  };
}

/**
 * State change subscriber
 */
type StateSubscriber = (newState: AppState, prevState: AppState) => void;

/**
 * Reducer function for state transitions
 * @param state - Current state
 * @param action - State action
 * @returns New state (immutable)
 */
function reducer(state: AppState, action: StateAction): AppState {
  switch (action.type) {
    case 'EDITOR_SET_CONTENT':
      if (state.editor.content === action.payload) {
        return state;
      }
      return {
        ...state,
        editor: { ...state.editor, content: action.payload },
      };

    case 'EDITOR_SET_TITLE':
      if (state.editor.title === action.payload) {
        return state;
      }
      return {
        ...state,
        editor: { ...state.editor, title: action.payload },
      };

    case 'EDITOR_TOGGLE_VIM': {
      const vimMode = action.payload ?? !state.editor.vimMode;
      if (vimMode === state.editor.vimMode) {
        return state;
      }
      return {
        ...state,
        editor: {
          ...state.editor,
          vimMode,
        },
      };
    }

    case 'EDITOR_TOGGLE_LIVE_MD': {
      const liveMarkdown = action.payload ?? !state.editor.liveMarkdown;
      if (liveMarkdown === state.editor.liveMarkdown) {
        return state;
      }
      return {
        ...state,
        editor: {
          ...state.editor,
          liveMarkdown,
        },
      };
    }

    case 'UI_SET_THEME':
      if (state.ui.theme === action.payload) {
        return state;
      }
      return {
        ...state,
        ui: { ...state.ui, theme: action.payload },
      };

    case 'UI_SET_LAYOUT':
      if (state.ui.layout === action.payload) {
        return state;
      }
      return {
        ...state,
        ui: { ...state.ui, layout: action.payload },
      };

    case 'UI_SET_MOBILE_PANE':
      if (state.ui.mobilePane === action.payload) {
        return state;
      }
      return {
        ...state,
        ui: { ...state.ui, mobilePane: action.payload },
      };

    case 'UI_SET_SPLIT_RATIO': {
      // Clamp ratio between min and max
      const clampedRatio = Math.max(
        CONFIG.features.useCM6 ? 0.3 : 0.2,
        Math.min(CONFIG.features.useCM6 ? 0.7 : 0.8, action.payload)
      );
      if (state.ui.splitRatio === clampedRatio) {
        return state;
      }
      return {
        ...state,
        ui: { ...state.ui, splitRatio: clampedRatio },
      };
    }

    case 'UI_TOGGLE_MENU': {
      const menuOpen = action.payload ?? !state.ui.menuOpen;
      if (state.ui.menuOpen === menuOpen) {
        return state;
      }
      return {
        ...state,
        ui: {
          ...state.ui,
          menuOpen,
        },
      };
    }

    case 'UI_SET_MODAL':
      if (state.ui.activeModal === action.payload) {
        return state;
      }
      return {
        ...state,
        ui: { ...state.ui, activeModal: action.payload },
      };

    case 'FONTS_SET_BODY':
      if (state.fonts.body === action.payload) {
        return state;
      }
      return {
        ...state,
        fonts: { ...state.fonts, body: action.payload },
      };

    case 'FONTS_SET_MONO':
      if (state.fonts.mono === action.payload) {
        return state;
      }
      return {
        ...state,
        fonts: { ...state.fonts, mono: action.payload },
      };

    case 'SHARE_SET_STATE':
      if (JSON.stringify(state.share) === JSON.stringify(action.payload)) {
        return state;
      }
      return {
        ...state,
        share: action.payload,
      };

    case 'RESET_STATE':
      if (JSON.stringify(state) === JSON.stringify(INITIAL_STATE)) {
        return state;
      }
      return cloneInitialState();

    default:
      // Exhaustive check - TypeScript will error if we miss a case
      return state;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createCompatResult(state: AppState, result: DispatchResult): DispatchResultCompat {
  return {
    ...state,
    ...result,
  };
}

function validateAction(action: unknown): { action?: StateAction; error?: DispatchError } {
  if (!isRecord(action) || typeof action.type !== 'string') {
    return {
      error: {
        code: 'INVALID_ACTION',
        message: 'Action must be an object with a string type field.',
      },
    };
  }

  switch (action.type) {
    case 'EDITOR_SET_CONTENT':
    case 'EDITOR_SET_TITLE':
      if (typeof action.payload !== 'string') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: `${action.type} requires a string payload.`,
          },
        };
      }
      break;
    case 'EDITOR_TOGGLE_VIM':
    case 'EDITOR_TOGGLE_LIVE_MD':
    case 'UI_TOGGLE_MENU':
      if (action.payload !== undefined && typeof action.payload !== 'boolean') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: `${action.type} payload must be boolean when provided.`,
          },
        };
      }
      break;
    case 'UI_SET_THEME':
      if (action.payload !== 'light' && action.payload !== 'dark' && action.payload !== 'system') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'UI_SET_THEME payload must be light, dark, or system.',
          },
        };
      }
      break;
    case 'UI_SET_LAYOUT':
      if (
        action.payload !== 'split' &&
        action.payload !== 'single' &&
        action.payload !== 'focus' &&
        action.payload !== 'mobile'
      ) {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'UI_SET_LAYOUT payload must be split, single, focus, or mobile.',
          },
        };
      }
      break;
    case 'UI_SET_MOBILE_PANE':
      if (action.payload !== 'editor' && action.payload !== 'preview') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'UI_SET_MOBILE_PANE payload must be editor or preview.',
          },
        };
      }
      break;
    case 'UI_SET_SPLIT_RATIO':
      if (typeof action.payload !== 'number' || Number.isNaN(action.payload)) {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'UI_SET_SPLIT_RATIO payload must be a valid number.',
          },
        };
      }
      break;
    case 'UI_SET_MODAL':
      if (action.payload !== null && typeof action.payload !== 'string') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'UI_SET_MODAL payload must be a string or null.',
          },
        };
      }
      break;
    case 'FONTS_SET_BODY':
      if (action.payload !== 'serif' && action.payload !== 'sans') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'FONTS_SET_BODY payload must be serif or sans.',
          },
        };
      }
      break;
    case 'FONTS_SET_MONO':
      if (action.payload !== 'plex' && action.payload !== 'system') {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'FONTS_SET_MONO payload must be plex or system.',
          },
        };
      }
      break;
    case 'SHARE_SET_STATE': {
      const payload = action.payload;
      if (
        !isRecord(payload) ||
        (payload.id !== null && typeof payload.id !== 'string') ||
        typeof payload.url !== 'string' ||
        (payload.type !== 'static' && payload.type !== 'live') ||
        (payload.privacy !== 'secret' && payload.privacy !== 'public')
      ) {
        return {
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'SHARE_SET_STATE payload must match ShareState contract.',
          },
        };
      }
      break;
    }
    case 'RESET_STATE':
      break;
    default:
      return {
        error: {
          code: 'INVALID_ACTION',
          message: `Unknown action type: ${action.type}`,
        },
      };
  }

  return { action: action as StateAction };
}

/**
 * StateManager - Centralized state management
 * @implements {IStateManager}
 */
export class StateManager {
  private state: AppState;
  private readonly storage: StorageAdapter;
  private readonly eventBus: EventBus;
  private readonly subscribers: Set<StateSubscriber> = new Set();
  private persistenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(storage: StorageAdapter, eventBus: EventBus) {
    this.storage = storage;
    this.eventBus = eventBus;
    this.state = this.loadInitialState();
  }

  /**
   * Load initial state from storage or use defaults
   */
  private loadInitialState(): AppState {
    const state = cloneInitialState();

    // Load from storage with error handling
    const loadFromStorage = (key: string, setter: (value: unknown) => void): void => {
      const result = this.storage.get(key, CONFIG.storageVersion);
      if (result.success && result.data !== undefined) {
        setter(result.data);
      }
    };

    // Load UI preferences
    loadFromStorage(STORAGE_KEYS.THEME, theme => {
      if (typeof theme === 'string') state.ui.theme = theme as Theme;
    });

    // Load split ratio
    loadFromStorage(STORAGE_KEYS.SPLIT_RATIO, ratio => {
      if (typeof ratio === 'number') state.ui.splitRatio = ratio;
    });

    // Load font preferences
    loadFromStorage(`${STORAGE_KEYS.FONTS}:body`, body => {
      if (typeof body === 'string') state.fonts.body = body as BodyFont;
    });
    loadFromStorage(`${STORAGE_KEYS.FONTS}:mono`, mono => {
      if (typeof mono === 'string') state.fonts.mono = mono as MonoFont;
    });

    // Load editor preferences
    loadFromStorage(STORAGE_KEYS.VIM_MODE, vim => {
      if (typeof vim === 'boolean') state.editor.vimMode = vim;
    });
    loadFromStorage(STORAGE_KEYS.LIVE_MD, live => {
      if (typeof live === 'boolean') state.editor.liveMarkdown = live;
    });

    return state;
  }

  /**
   * Dispatch an action to update state
   * @param action - State action
   * @returns New state
   */
  dispatch(action: unknown): DispatchResultCompat {
    const validation = validateAction(action);
    const prevState = this.state;

    if (!validation.action || validation.error) {
      const result: DispatchResult = {
        ok: false,
        state: prevState,
        prevState,
        changed: false,
        error: validation.error,
      };
      return createCompatResult(prevState, result);
    }

    const validatedAction = validation.action;

    if (validatedAction.type === 'UI_SET_MOBILE_PANE' && prevState.ui.layout !== 'mobile') {
      const result: DispatchResult = {
        ok: false,
        state: prevState,
        prevState,
        changed: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'UI_SET_MOBILE_PANE is only valid when layout is mobile.',
        },
      };
      return createCompatResult(prevState, result);
    }

    const newState = reducer(prevState, validatedAction);
    const changed = newState !== prevState;

    // Only update if state changed
    if (changed) {
      this.state = newState;

      // Notify subscribers
      for (const subscriber of this.subscribers) {
        try {
          subscriber(newState, prevState);
        } catch (error) {
          console.error('[StateManager] Subscriber error:', error);
        }
      }

      // Emit event
      this.eventBus.emit(
        'state:changed',
        { action: validatedAction, newState, prevState },
        'StateManager.dispatch'
      );

      // Schedule persistence
      this.schedulePersistence();
    }

    const result: DispatchResult = {
      ok: true,
      state: this.state,
      prevState,
      changed,
    };

    return createCompatResult(this.state, result);
  }

  /**
   * Get current state
   * @returns Current state (read-only copy)
   */
  getState(): Readonly<AppState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Subscribe to state changes
   * @param subscriber - Subscriber function
   * @returns Unsubscribe function
   */
  subscribe(subscriber: StateSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Schedule state persistence to storage
   * Debounced to avoid excessive writes
   */
  private schedulePersistence(): void {
    if (this.persistenceTimer) {
      clearTimeout(this.persistenceTimer);
    }

    this.persistenceTimer = setTimeout(() => {
      this.persistState();
    }, 100);
  }

  /**
   * Persist state to storage
   */
  private persistState(): void {
    const { editor, ui, fonts } = this.state;

    // Persist UI preferences
    this.storage.set(STORAGE_KEYS.THEME, ui.theme, CONFIG.storageVersion);
    this.storage.set(STORAGE_KEYS.SPLIT_RATIO, ui.splitRatio, CONFIG.storageVersion);

    // Persist font preferences
    this.storage.set(`${STORAGE_KEYS.FONTS}:body`, fonts.body, CONFIG.storageVersion);
    this.storage.set(`${STORAGE_KEYS.FONTS}:mono`, fonts.mono, CONFIG.storageVersion);

    // Persist editor preferences
    this.storage.set(STORAGE_KEYS.VIM_MODE, editor.vimMode, CONFIG.storageVersion);
    this.storage.set(STORAGE_KEYS.LIVE_MD, editor.liveMarkdown, CONFIG.storageVersion);

    // Note: Share state is NOT persisted (INV-002)
    // Note: Editor content is NOT auto-persisted (intentional)
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.dispatch({ type: 'RESET_STATE' });
  }

  /**
   * Cleanup and unsubscribe
   */
  destroy(): void {
    if (this.persistenceTimer) {
      clearTimeout(this.persistenceTimer);
    }
    this.subscribers.clear();
  }
}
