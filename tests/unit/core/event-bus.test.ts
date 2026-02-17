import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/core/event-bus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on/off', () => {
    it('subscribes and receives canonical envelopes', () => {
      const handler = vi.fn();
      eventBus.on('state:changed', handler);

      const result = eventBus.emit('state:changed', { test: true }, 'unit-test');

      expect(handler).toHaveBeenCalledTimes(1);
      const envelope = handler.mock.calls[0][0] as {
        event: string;
        payload: { test: boolean };
        source: string;
      };
      expect(envelope.event).toBe('state:changed');
      expect(envelope.payload.test).toBe(true);
      expect(envelope.source).toBe('unit-test');
      expect(result.delivered).toBe(1);
    });

    it('supports multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('state:changed', handler1);
      eventBus.on('state:changed', handler2);

      const result = eventBus.emit('state:changed', 'test');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(result.delivered).toBe(2);
      expect(result.envelope.source).toBe('unknown');
    });

    it('unsubscribes correctly', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('state:changed', handler);

      eventBus.emit('state:changed', 'test1');
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventBus.emit('state:changed', 'test2');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('allows off() to remove specific handler', () => {
      const handler = vi.fn();
      eventBus.on('state:changed', handler);
      eventBus.off('state:changed', handler);

      eventBus.emit('state:changed', 'test');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('subscribeAll contract', () => {
    it('subscribeAll receives same envelope data as event-specific handlers', () => {
      const directHandler = vi.fn();
      const allHandler = vi.fn();

      eventBus.on('editor:change', directHandler);
      eventBus.subscribeAll(allHandler);

      eventBus.emit('editor:change', { value: 'abc' }, 'layout-manager');

      const directEnvelope = directHandler.mock.calls[0][0] as {
        event: string;
        payload: { value: string };
        source: string;
      };
      const allEnvelope = allHandler.mock.calls[0][0] as {
        event: string;
        payload: { value: string };
        source: string;
      };

      expect(allEnvelope.event).toBe(directEnvelope.event);
      expect(allEnvelope.payload).toEqual(directEnvelope.payload);
      expect(allEnvelope.source).toBe(directEnvelope.source);
    });

    it('preserves ordering for sequential emits', () => {
      const orderedSources: string[] = [];

      eventBus.subscribeAll(envelope => {
        orderedSources.push(envelope.source);
      });

      eventBus.emit('editor:focus', undefined, 's1');
      eventBus.emit('editor:focus', undefined, 's2');
      eventBus.emit('editor:focus', undefined, 's3');

      expect(orderedSources).toEqual(['s1', 's2', 's3']);
    });

    it('preserves deterministic envelope ordering under microtask and timeout interleaving', async () => {
      const directOrder: string[] = [];
      const allOrder: string[] = [];
      const deliveredCounts: number[] = [];

      eventBus.on('editor:change', envelope => {
        directOrder.push(envelope.source);
      });

      eventBus.subscribeAll(envelope => {
        if (envelope.event === 'editor:change') {
          allOrder.push(envelope.source);
        }
      });

      const tasks = [
        new Promise<void>(resolve => {
          queueMicrotask(() => {
            const result = eventBus.emit('editor:change', { id: 1 }, 'micro-1');
            deliveredCounts.push(result.delivered);
            resolve();
          });
        }),
        new Promise<void>(resolve => {
          setTimeout(() => {
            const result = eventBus.emit('editor:change', { id: 2 }, 'timeout-1');
            deliveredCounts.push(result.delivered);
            resolve();
          }, 0);
        }),
        new Promise<void>(resolve => {
          queueMicrotask(() => {
            const result = eventBus.emit('editor:change', { id: 3 }, 'micro-2');
            deliveredCounts.push(result.delivered);
            resolve();
          });
        }),
        new Promise<void>(resolve => {
          setTimeout(() => {
            const result = eventBus.emit('editor:change', { id: 4 }, 'timeout-2');
            deliveredCounts.push(result.delivered);
            resolve();
          }, 0);
        }),
      ];

      await Promise.all(tasks);

      expect(directOrder).toEqual(['micro-1', 'micro-2', 'timeout-1', 'timeout-2']);
      expect(allOrder).toEqual(directOrder);
      expect(deliveredCounts).toEqual([1, 1, 1, 1]);
    });
  });

  describe('once', () => {
    it('fires once', () => {
      const handler = vi.fn();
      eventBus.once('state:changed', handler);

      eventBus.emit('state:changed', 'test1');
      eventBus.emit('state:changed', 'test2');

      expect(handler).toHaveBeenCalledTimes(1);
      const envelope = handler.mock.calls[0][0] as { payload: string };
      expect(envelope.payload).toBe('test1');
    });
  });

  describe('listenerCount', () => {
    it('returns correct count', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      expect(eventBus.listenerCount('state:changed')).toBe(0);

      eventBus.on('state:changed', handler1);
      expect(eventBus.listenerCount('state:changed')).toBe(1);

      eventBus.on('state:changed', handler2);
      expect(eventBus.listenerCount('state:changed')).toBe(2);

      eventBus.off('state:changed', handler1);
      expect(eventBus.listenerCount('state:changed')).toBe(1);
    });
  });

  describe('removeAllListeners', () => {
    it('removes all listeners for specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('state:changed', handler1);
      eventBus.on('editor:change', handler2);

      eventBus.removeAllListeners('state:changed');

      eventBus.emit('state:changed', 'test');
      eventBus.emit('editor:change', 'test');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('removes all listeners when called without event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const all = vi.fn();

      eventBus.on('state:changed', handler1);
      eventBus.on('editor:change', handler2);
      eventBus.subscribeAll(all);

      eventBus.removeAllListeners();

      eventBus.emit('state:changed', 'test');
      eventBus.emit('editor:change', 'test');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(all).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('continues emitting even if a handler throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      eventBus.on('state:changed', errorHandler);
      eventBus.on('state:changed', normalHandler);

      expect(() => {
        eventBus.emit('state:changed', 'test');
      }).not.toThrow();
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });

    it('isolates subscribeAll failure injection from event handlers', () => {
      const allHandler = vi.fn(() => {
        throw new Error('all failed');
      });
      const normalHandler = vi.fn();

      eventBus.subscribeAll(allHandler);
      eventBus.on('editor:focus', normalHandler);

      expect(() => {
        eventBus.emit('editor:focus', undefined, 'test-source');
      }).not.toThrow();

      expect(normalHandler).toHaveBeenCalledTimes(1);
    });
  });
});
