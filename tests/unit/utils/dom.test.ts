import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addEventListener,
  debounce,
  qsa,
  qs,
  removeAllEventListeners,
  throttle,
} from '../../../src/utils/dom';

describe('dom utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <button id="first">One</button>
        <button id="second">Two</button>
      </main>
    `;
    vi.useRealTimers();
  });

  it('qs returns matching element', () => {
    const button = qs('button');
    expect(button).not.toBeNull();
    expect(button?.id).toBe('first');
  });

  it('qsa returns all matching elements', () => {
    const buttons = qsa<HTMLButtonElement>('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[1].id).toBe('second');
  });

  it('addEventListener cleanup removes listener', () => {
    const button = qs('button') as HTMLButtonElement;
    const handler = vi.fn();

    const cleanup = addEventListener(button, 'click', handler);
    button.click();
    cleanup();
    button.click();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removeAllEventListeners runs all cleanup functions', () => {
    const first = qs('#first') as HTMLButtonElement;
    const second = qs('#second') as HTMLButtonElement;
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const cleanups = [
      addEventListener(first, 'click', firstHandler),
      addEventListener(second, 'click', secondHandler),
    ];

    removeAllEventListeners(cleanups);

    first.click();
    second.click();

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).not.toHaveBeenCalled();
  });

  it('throttle executes at configured rate', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.101Z'));
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('debounce executes once with latest call', () => {
    vi.useFakeTimers();

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    debounced('b');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });
});
