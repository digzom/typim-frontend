/**
 * CodeMirror 6 Editor Engine
 * Implements IEditorEngine interface
 * @module editor/cm6/index
 */

import type { IEditorEngine, CursorPosition, ScrollInfo, EditorEvent } from '../../core/types';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import {
  createEditor,
  getValue,
  setValue,
  getCursor,
  setCursor,
  getScrollInfo,
  scrollTo,
  focus,
  hasFocus,
  destroy,
} from './setup';

/**
 * Event handler map
 */
type EventHandlerMap = {
  [K in EditorEvent]: Set<(...args: unknown[]) => void>;
};

/**
 * CM6EditorEngine - CodeMirror 6 implementation of IEditorEngine
 * @implements {IEditorEngine}
 */
export class CM6EditorEngine implements IEditorEngine {
  private static readonly MAX_METHOD_LATENCY_MS = 16;

  private view: EditorView | null = null;
  private eventHandlers: Partial<EventHandlerMap> = {};
  private scrollListener: (() => void) | null = null;

  private measureMethod<T>(name: string, callback: () => T): T {
    const start = performance.now();
    const result = callback();
    const latencyMs = performance.now() - start;

    if (latencyMs > CM6EditorEngine.MAX_METHOD_LATENCY_MS) {
      console.warn('[CM6EditorEngine] method exceeded latency budget', {
        method: name,
        latencyMs,
        budgetMs: CM6EditorEngine.MAX_METHOD_LATENCY_MS,
      });
    }

    return result;
  }

  /**
   * Initialize the editor
   * @param container - DOM container element
   * @param initialValue - Initial document content
   * @param extensions - Additional extensions
   */
  initialize(container: HTMLElement, initialValue = '', extensions: Extension[] = []): void {
    const eventBridgeExtension = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        this.emit('change', update.state.doc.toString());
      }

      if (update.selectionSet) {
        this.emit('cursorActivity', this.getCursor());
      }

      if (update.focusChanged) {
        if (update.view.hasFocus) {
          this.emit('focus');
        } else {
          this.emit('blur');
        }
      }
    });

    this.view = createEditor(container, initialValue, [...extensions, eventBridgeExtension]);

    // Set up internal listeners
    this.setupInternalListeners();
  }

  /**
   * Set up internal event listeners to bridge to IEditorEngine events
   */
  private setupInternalListeners(): void {
    if (!this.view) return;

    // Scroll listener (throttled)
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    this.scrollListener = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        this.emit('scroll', this.getScrollInfo());
        scrollTimeout = null;
      }, 16); // ~60fps
    };

    // Set up scroll listener on the scroll DOM
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.scrollListener) {
      this.view.scrollDOM.addEventListener('scroll', this.scrollListener);
    }

    // Note: change events are handled via state manager subscriptions
  }

  /**
   * Emit an event to registered handlers
   * @param event - Event name
   * @param args - Event arguments
   */
  private emit(event: EditorEvent, ...args: unknown[]): void {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[CM6EditorEngine] Error in ${event} handler:`, error);
        }
      }
    }
  }

  /**
   * Get current document value
   * @returns Document text
   */
  getValue(): string {
    return this.measureMethod('getValue', () => {
      if (!this.view) return '';
      return getValue(this.view);
    });
  }

  /**
   * Set document value
   * @param value - New document text
   */
  setValue(value: string): void {
    this.measureMethod('setValue', () => {
      if (!this.view) return;
      setValue(this.view, value);
    });
  }

  /**
   * Get cursor position
   * @returns Cursor position
   */
  getCursor(): CursorPosition {
    return this.measureMethod('getCursor', () => {
      if (!this.view) return { line: 0, ch: 0 };
      return getCursor(this.view);
    });
  }

  /**
   * Set cursor position
   * @param pos - Cursor position
   */
  setCursor(pos: CursorPosition): void {
    this.measureMethod('setCursor', () => {
      if (!this.view) return;
      setCursor(this.view, pos);
    });
  }

  /**
   * Get scroll information
   * @returns Scroll info
   */
  getScrollInfo(): ScrollInfo {
    return this.measureMethod('getScrollInfo', () => {
      if (!this.view) return { top: 0, height: 0, clientHeight: 0 };
      return getScrollInfo(this.view);
    });
  }

  /**
   * Scroll to position
   * @param top - Scroll position
   */
  scrollTo(top: number): void {
    this.measureMethod('scrollTo', () => {
      if (!this.view) return;
      scrollTo(this.view, top);
    });
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.measureMethod('focus', () => {
      if (!this.view) return;
      focus(this.view);
    });
  }

  /**
   * Check if editor has focus
   * @returns True if focused
   */
  hasFocus(): boolean {
    return this.measureMethod('hasFocus', () => {
      if (!this.view) return false;
      return hasFocus(this.view);
    });
  }

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on(event: EditorEvent, handler: (...args: unknown[]) => void): () => void {
    let handlers = this.eventHandlers[event];
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers[event] = handlers;
    }
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler
   */
  off(event: EditorEvent, handler: (...args: unknown[]) => void): void {
    this.eventHandlers[event]?.delete(handler);
  }

  /**
   * Destroy the editor instance
   */
  destroy(): void {
    if (this.view) {
      if (this.scrollListener) {
        this.view.scrollDOM.removeEventListener('scroll', this.scrollListener);
      }
      destroy(this.view);
      this.view = null;
    }
    this.eventHandlers = {};
    this.scrollListener = null;
  }

  /**
   * Get the underlying EditorView instance (for advanced usage)
   * @returns EditorView or null
   */
  getView(): EditorView | null {
    return this.view;
  }
}
