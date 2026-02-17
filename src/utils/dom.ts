/**
 * DOM utility functions
 * @module utils/dom
 */

/**
 * Type-safe query selector
 * @param selector - CSS selector
 * @param parent - Parent element (default: document)
 * @returns Typed element or null
 */
export function qs<K extends keyof HTMLElementTagNameMap>(
  selector: K,
  parent?: HTMLElement | Document
): HTMLElementTagNameMap[K] | null;
export function qs<K extends keyof SVGElementTagNameMap>(
  selector: K,
  parent?: HTMLElement | Document
): SVGElementTagNameMap[K] | null;
export function qs(
  selector: string,
  parent?: HTMLElement | Document
): Element | null;
export function qs(
  selector: string,
  parent: HTMLElement | Document = document
): Element | null {
  return parent.querySelector(selector);
}

/**
 * Type-safe query selector all
 * @param selector - CSS selector
 * @param parent - Parent element (default: document)
 * @returns Array of typed elements
 */
export function qsa<K extends keyof HTMLElementTagNameMap>(
  selector: K,
  parent?: HTMLElement | Document
): HTMLElementTagNameMap[K][];
export function qsa<K extends keyof SVGElementTagNameMap>(
  selector: K,
  parent?: HTMLElement | Document
): SVGElementTagNameMap[K][];
export function qsa<E extends Element = Element>(
  selector: string,
  parent?: HTMLElement | Document
): E[];
export function qsa(
  selector: string,
  parent: HTMLElement | Document = document
): Element[] {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Element creation helper
 * @param tagName - HTML tag name
 * @param options - Element options
 * @returns Created element
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: {
    className?: string;
    id?: string;
    textContent?: string;
    innerHTML?: string;
    attributes?: Record<string, string>;
    dataset?: Record<string, string>;
    parent?: HTMLElement;
  }
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (options?.className) {
    element.className = options.className;
  }

  if (options?.id) {
    element.id = options.id;
  }

  if (options?.textContent) {
    element.textContent = options.textContent;
  }

  if (options?.innerHTML) {
    element.innerHTML = options.innerHTML;
  }

  if (options?.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      element.setAttribute(key, value);
    }
  }

  if (options?.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      element.dataset[key] = value;
    }
  }

  if (options?.parent) {
    options.parent.appendChild(element);
  }

  return element;
}

/**
 * Event listener with automatic cleanup
 * @param target - Event target
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event listener options
 * @returns Cleanup function
 */
export function addEventListener<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Document | Window,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  target.addEventListener(event, handler as EventListener, options);

  return () => {
    target.removeEventListener(event, handler as EventListener, options);
  };
}

/**
 * Batch remove event listeners
 * @param cleanups - Array of cleanup functions
 */
export function removeAllEventListeners(cleanups: Array<() => void>): void {
  for (const cleanup of cleanups) {
    cleanup();
  }
}

/**
 * Throttle function execution
 * @param fn - Function to throttle
 * @param delay - Throttle delay in ms
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Debounce function execution
 * @param fn - Function to debounce
 * @param delay - Debounce delay in ms
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * ResizeObserver wrapper with cleanup
 * @param element - Element to observe
 * @param callback - Resize callback
 * @returns Cleanup function
 */
export function observeResize(
  element: Element,
  callback: (entries: ResizeObserverEntry[]) => void
): () => void {
  if (typeof ResizeObserver === 'undefined') {
    return () => {
      // No-op if ResizeObserver not available
    };
  }

  const observer = new ResizeObserver(callback);
  observer.observe(element);

  return () => {
    observer.disconnect();
  };
}

/**
 * IntersectionObserver wrapper with cleanup
 * @param elements - Elements to observe
 * @param callback - Intersection callback
 * @param options - IntersectionObserver options
 * @returns Cleanup function
 */
export function observeIntersection(
  elements: Element | Element[],
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    return () => {
      // No-op if IntersectionObserver not available
    };
  }

  const observer = new IntersectionObserver(callback, options);
  const elementArray = Array.isArray(elements) ? elements : [elements];

  for (const element of elementArray) {
    observer.observe(element);
  }

  return () => {
    observer.disconnect();
  };
}

/**
 * Check if element is in viewport
 * @param element - Element to check
 * @returns True if element is in viewport
 */
export function isInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view with smooth behavior
 * @param element - Element to scroll to
 * @param options - Scroll options
 */
export function scrollIntoView(
  element: Element,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' }
): void {
  element.scrollIntoView(options);
}

/**
 * Get element offset relative to document
 * @param element - Element to get offset for
 * @returns Offset coordinates
 */
export function getOffset(element: Element): { top: number; left: number } {
  const rect = element.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
  };
}

/**
 * Check if user is on macOS
 * @returns True if macOS
 */
export function isMac(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Get modifier key for platform (Cmd on Mac, Ctrl elsewhere)
 * @returns Modifier key string
 */
export function getModifierKey(): 'Meta' | 'Control' {
  return isMac() ? 'Meta' : 'Control';
}

/**
 * Check if keyboard event uses platform modifier key
 * @param event - Keyboard event
 * @returns True if modifier key is pressed
 */
export function isModifierPressed(event: KeyboardEvent): boolean {
  return isMac() ? event.metaKey : event.ctrlKey;
}
