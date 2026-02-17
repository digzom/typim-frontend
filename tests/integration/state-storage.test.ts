import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/event-bus';
import { StateManager } from '../../src/core/state';
import { StorageAdapter } from '../../src/utils/storage';

describe('StateManager + StorageAdapter integration', () => {
  it('persists theme and split ratio changes', async () => {
    const storage = new StorageAdapter();
    storage.clearAll();

    const manager = new StateManager(storage, new EventBus());
    manager.dispatch({ type: 'UI_SET_THEME', payload: 'dark' });
    manager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: 0.64 });

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(storage.get('typim:theme', 1).data).toBe('dark');
    expect(storage.get('typim:splitRatio', 1).data).toBe(0.64);
  });
});
