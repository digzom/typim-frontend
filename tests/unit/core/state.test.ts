import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager, INITIAL_STATE } from '../../../src/core/state';
import { StorageAdapter } from '../../../src/utils/storage';
import { EventBus } from '../../../src/core/event-bus';

describe('StateManager', () => {
  let stateManager: StateManager;
  let storage: StorageAdapter;
  let eventBus: EventBus;

  beforeEach(() => {
    storage = new StorageAdapter();
    storage.clearAll();
    eventBus = new EventBus();
    stateManager = new StateManager(storage, eventBus);
  });

  afterEach(() => {
    stateManager.destroy();
    storage.clearAll();
  });

  describe('initial state', () => {
    it('returns initial state', () => {
      const state = stateManager.getState();

      expect(state.editor.content).toBe(INITIAL_STATE.editor.content);
      expect(state.editor.title).toBe('Untitled');
      expect(state.ui.theme).toBe('light');
      expect(state.ui.mobilePane).toBe('editor');
    });

    it('loads persisted preferences', () => {
      storage.set('typim:theme', 'dark', 1);
      storage.set('typim:splitRatio', 0.6, 1);

      const manager = new StateManager(storage, eventBus);
      const state = manager.getState();

      expect(state.ui.theme).toBe('dark');
      expect(state.ui.splitRatio).toBe(0.6);
    });
  });

  describe('dispatch contract', () => {
    it('returns structured dispatch result and compatibility state fields', () => {
      const result = stateManager.dispatch({ type: 'EDITOR_SET_CONTENT', payload: 'New content' });

      expect(result.ok).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.editor.content).toBe('New content');
      expect(result.state.editor.content).toBe('New content');
      expect(result.prevState.editor.content).toBe(INITIAL_STATE.editor.content);
    });

    it('rejects invalid action and preserves state', () => {
      const before = JSON.stringify(stateManager.getState());
      const result = stateManager.dispatch({ bad: true });

      expect(result.ok).toBe(false);
      expect(result.changed).toBe(false);
      expect(result.error?.code).toBe('INVALID_ACTION');
      expect(JSON.stringify(result.state)).toBe(before);
      expect(JSON.stringify(stateManager.getState())).toBe(before);
    });

    it('rejects invalid payload', () => {
      const result = stateManager.dispatch({ type: 'UI_SET_THEME', payload: 'blue' });

      expect(result.ok).toBe(false);
      expect(result.changed).toBe(false);
      expect(result.error?.code).toBe('INVALID_PAYLOAD');
    });

    it('idempotent dispatch returns changed=false and emits no extra event', () => {
      const stateChanged = vi.fn();
      eventBus.on('state:changed', stateChanged);

      const first = stateManager.dispatch({ type: 'EDITOR_SET_TITLE', payload: 'Same title' });
      const snapshot = JSON.stringify(first.state);
      const second = stateManager.dispatch({ type: 'EDITOR_SET_TITLE', payload: 'Same title' });

      expect(first.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(JSON.stringify(second.state)).toBe(snapshot);
      expect(stateChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions', () => {
    it('handles EDITOR_TOGGLE_VIM', () => {
      expect(stateManager.getState().editor.vimMode).toBe(false);

      let state = stateManager.dispatch({ type: 'EDITOR_TOGGLE_VIM' });
      expect(state.editor.vimMode).toBe(true);

      state = stateManager.dispatch({ type: 'EDITOR_TOGGLE_VIM' });
      expect(state.editor.vimMode).toBe(false);
    });

    it('handles UI_SET_SPLIT_RATIO with clamping', () => {
      let state = stateManager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: 0.1 });
      expect(state.ui.splitRatio).toBe(0.3);

      state = stateManager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: 0.9 });
      expect(state.ui.splitRatio).toBe(0.7);

      state = stateManager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: 0.5 });
      expect(state.ui.splitRatio).toBe(0.5);
    });

    it('handles UI_SET_MOBILE_PANE', () => {
      stateManager.dispatch({ type: 'UI_SET_LAYOUT', payload: 'mobile' });
      const state = stateManager.dispatch({ type: 'UI_SET_MOBILE_PANE', payload: 'preview' });

      expect(state.ok).toBe(true);
      expect(state.ui.mobilePane).toBe('preview');
    });

    it('handles RESET_STATE', () => {
      stateManager.dispatch({ type: 'EDITOR_TOGGLE_VIM', payload: true });
      stateManager.dispatch({ type: 'UI_SET_THEME', payload: 'dark' });

      const state = stateManager.dispatch({ type: 'RESET_STATE' });

      expect(state.editor.vimMode).toBe(INITIAL_STATE.editor.vimMode);
      expect(state.ui.theme).toBe(INITIAL_STATE.ui.theme);
      expect(state.ui.mobilePane).toBe(INITIAL_STATE.ui.mobilePane);
    });
  });

  describe('state events', () => {
    it('emits state:changed envelope with source', () => {
      const handler = vi.fn();
      eventBus.on('state:changed', handler);

      stateManager.dispatch({ type: 'EDITOR_SET_TITLE', payload: 'Event test' });

      const envelope = handler.mock.calls[0][0] as {
        source: string;
        payload: {
          action: { type: string };
        };
      };

      expect(envelope.payload.action.type).toBe('EDITOR_SET_TITLE');
      expect(envelope.source).toBe('StateManager.dispatch');
    });

    it('preserves deterministic ordering for sequential dispatches', () => {
      const orderedActions: string[] = [];

      eventBus.on('state:changed', envelope => {
        const payload = envelope.payload as { action: { type: string } };
        orderedActions.push(payload.action.type);
      });

      stateManager.dispatch({ type: 'EDITOR_SET_TITLE', payload: 'A' });
      stateManager.dispatch({ type: 'UI_SET_THEME', payload: 'dark' });
      stateManager.dispatch({ type: 'UI_SET_THEME', payload: 'light' });

      expect(orderedActions).toEqual(['EDITOR_SET_TITLE', 'UI_SET_THEME', 'UI_SET_THEME']);
    });

    it('preserves deterministic ordering under concurrent microtask and timeout dispatch interleaving', async () => {
      const orderedActions: string[] = [];

      eventBus.on('state:changed', envelope => {
        const payload = envelope.payload as { action: { type: string } };
        orderedActions.push(payload.action.type);
      });

      const tasks = [
        new Promise<void>(resolve => {
          queueMicrotask(() => {
            stateManager.dispatch({ type: 'EDITOR_SET_TITLE', payload: 'Microtask title' });
            resolve();
          });
        }),
        new Promise<void>(resolve => {
          setTimeout(() => {
            stateManager.dispatch({ type: 'UI_SET_THEME', payload: 'dark' });
            resolve();
          }, 0);
        }),
        new Promise<void>(resolve => {
          queueMicrotask(() => {
            stateManager.dispatch({ type: 'EDITOR_SET_CONTENT', payload: 'Microtask content' });
            resolve();
          });
        }),
        new Promise<void>(resolve => {
          setTimeout(() => {
            stateManager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: 0.62 });
            resolve();
          }, 0);
        }),
      ];

      await Promise.all(tasks);

      expect(orderedActions).toEqual([
        'EDITOR_SET_TITLE',
        'EDITOR_SET_CONTENT',
        'UI_SET_THEME',
        'UI_SET_SPLIT_RATIO',
      ]);

      const state = stateManager.getState();
      expect(state.editor.title).toBe('Microtask title');
      expect(state.editor.content).toBe('Microtask content');
      expect(state.ui.theme).toBe('dark');
      expect(state.ui.splitRatio).toBe(0.62);
    });
  });

  describe('persistence', () => {
    it('persists theme changes', async () => {
      stateManager.dispatch({ type: 'UI_SET_THEME', payload: 'dark' });

      await new Promise(resolve => setTimeout(resolve, 150));
      const result = storage.get('typim:theme', 1);
      expect(result.data).toBe('dark');
    });

    it('persists font changes', async () => {
      stateManager.dispatch({ type: 'FONTS_SET_BODY', payload: 'sans' });

      await new Promise(resolve => setTimeout(resolve, 200));
      const result = storage.get('typim:fonts:body', 1);
      expect(result.data).toBe('sans');
    });
  });
});
