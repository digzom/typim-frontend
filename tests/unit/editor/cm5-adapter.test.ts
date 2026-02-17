import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CM5EditorEngine } from '../../../src/editor/cm5-adapter';

describe('CM5EditorEngine', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).CodeMirror;
  });

  it('initializes using global CodeMirror factory', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    let value = '# legacy';

    const instance = {
      getValue: () => value,
      setValue: (next: string) => {
        value = next;
      },
      getCursor: () => ({ line: 0, ch: 0 }),
      setCursor: vi.fn(),
      getScrollInfo: () => ({ top: 0, height: 100, clientHeight: 50 }),
      scrollTo: vi.fn(),
      focus: vi.fn(),
      hasFocus: () => true,
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler);
      },
      off: vi.fn(),
      getWrapperElement: () => {
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        return wrapper;
      },
    };

    const codeMirrorFactory = vi.fn(() => instance);
    (window as unknown as Record<string, unknown>).CodeMirror = codeMirrorFactory;

    const engine = new CM5EditorEngine();
    const container = document.createElement('div');

    engine.initialize(container, '# legacy');

    expect(codeMirrorFactory).toHaveBeenCalledTimes(1);
    expect(engine.getValue()).toBe('# legacy');

    engine.setValue('# updated');
    expect(engine.getValue()).toBe('# updated');

    const changeHandler = vi.fn();
    engine.on('change', changeHandler);
    handlers.get('change')?.();

    expect(changeHandler).toHaveBeenCalledWith('# updated');

    engine.destroy();
  });
});
