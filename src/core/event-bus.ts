/**
 * EventBus - Centralized event communication
 * Implements IEventBus interface with typed events
 * @module core/event-bus
 */

import type { AppEvent, EventEmitResult, EventEnvelope, EventHandler, EventPayload } from './types';

/**
 * Event subscription entry
 */
interface Subscription {
  handler: EventHandler;
  envelope: EventEnvelope;
}

/**
 * EventBus provides decoupled event communication between modules
 * @implements {IEventBus}
 */
export class EventBus {
  private readonly subscribers: Map<AppEvent, Set<EventHandler>> = new Map();
  private readonly allSubscribers: Set<(envelope: EventEnvelope) => void> = new Set();
  private readonly onceSubscribers: Map<AppEvent, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: AppEvent, handler: EventHandler): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }

    const handlers = this.subscribers.get(event);
    if (!handlers) {
      return () => {
        // No-op if no handlers set
      };
    }
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * Subscribe to an event for one emission only
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once(event: AppEvent, handler: EventHandler): () => void {
    if (!this.onceSubscribers.has(event)) {
      this.onceSubscribers.set(event, new Set());
    }

    const handlers = this.onceSubscribers.get(event);
    if (!handlers) {
      return () => {
        // No-op if no handlers set
      };
    }
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler function
   */
  off(event: AppEvent, handler: EventHandler): void {
    const handlers = this.subscribers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }

    const onceHandlers = this.onceSubscribers.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
    }
  }

  /**
   * Emit an event synchronously
   * @param event - Event name
   * @param payload - Event payload
   * @param source - Source module identifier
   */
  emit(event: AppEvent, payload?: EventPayload, source = 'unknown'): EventEmitResult {
    const envelope: EventEnvelope = {
      event,
      payload,
      source,
      timestamp: Date.now(),
    };

    const handlers = this.subscribers.get(event);
    const onceHandlers = this.onceSubscribers.get(event);
    let delivered = 0;

    const dispatchToHandler = (subscription: Subscription): void => {
      try {
        subscription.handler(subscription.envelope);
        delivered += 1;
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${event}:`, error);
      }
    };

    const dispatchToAllSubscribers = (): void => {
      for (const callback of this.allSubscribers) {
        try {
          callback(envelope);
        } catch (error) {
          console.error(`[EventBus] Error in subscribeAll handler for ${event}:`, error);
        }
      }
    };

    // Notify all handlers
    if (handlers) {
      for (const handler of handlers) {
        dispatchToHandler({ handler, envelope });
      }
    }

    // Notify once handlers and clear them
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        dispatchToHandler({ handler, envelope });
      }
      this.onceSubscribers.delete(event);
    }

    dispatchToAllSubscribers();

    return {
      delivered,
      envelope,
    };
  }

  /**
   * Emit an event asynchronously (next tick)
   * @param event - Event name
   * @param payload - Event payload
   */
  emitAsync(event: AppEvent, payload?: EventPayload, source = 'unknown'): void {
    setTimeout(() => {
      this.emit(event, payload, source);
    }, 0);
  }

  /**
   * Subscribe to all events (for debugging/logging)
   * @param callback - Callback receiving all events
   * @returns Unsubscribe function
   */
  subscribeAll(callback: (envelope: EventEnvelope) => void): () => void {
    this.allSubscribers.add(callback);
    return () => {
      this.allSubscribers.delete(callback);
    };
  }

  /**
   * Remove all subscribers for an event
   * @param event - Event name
   */
  removeAllListeners(event?: AppEvent): void {
    if (event) {
      this.subscribers.delete(event);
      this.onceSubscribers.delete(event);
    } else {
      this.subscribers.clear();
      this.onceSubscribers.clear();
      this.allSubscribers.clear();
    }
  }

  /**
   * Get count of subscribers for an event
   * @param event - Event name
   * @returns Number of subscribers
   */
  listenerCount(event: AppEvent): number {
    const handlers = this.subscribers.get(event);
    const onceHandlers = this.onceSubscribers.get(event);
    return (handlers?.size ?? 0) + (onceHandlers?.size ?? 0);
  }
}

/** Singleton instance for global event bus */
export const globalEventBus = new EventBus();
