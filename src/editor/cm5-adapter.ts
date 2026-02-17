import type { CursorPosition, EditorEvent, IEditorEngine, ScrollInfo } from '../core/types';

type LegacyHandler = (...args: unknown[]) => void;

interface CM5EditorInstance {
  getValue(): string;
  setValue(value: string): void;
  getCursor(): { line: number; ch: number };
  setCursor(pos: { line: number; ch: number }): void;
  getScrollInfo(): { top: number; height: number; clientHeight: number };
  scrollTo(left: number | null, top: number): void;
  focus(): void;
  hasFocus(): boolean;
  on(event: string, handler: LegacyHandler): void;
  off(event: string, handler: LegacyHandler): void;
  getWrapperElement(): HTMLElement;
}

type CM5Factory = (element: HTMLElement, options: Record<string, unknown>) => CM5EditorInstance;

interface WindowWithCM5 extends Window {
  CodeMirror?: CM5Factory;
}

const CM5_SCRIPT_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/markdown/markdown.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/keymap/vim.min.js',
];

let cm5LoadPromise: Promise<boolean> | null = null;

function loadScript(source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-cm5-src="${source}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${source}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.dataset.cm5Src = source;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${source}`)));
    document.head.appendChild(script);
  });
}

export async function ensureCM5Loaded(): Promise<boolean> {
  const globalWindow = window as WindowWithCM5;
  if (globalWindow.CodeMirror) {
    return true;
  }

  if (!cm5LoadPromise) {
    cm5LoadPromise = (async () => {
      try {
        for (const url of CM5_SCRIPT_URLS) {
          await loadScript(url);
        }

        return Boolean((window as WindowWithCM5).CodeMirror);
      } catch {
        return false;
      }
    })();
  }

  return cm5LoadPromise;
}

type EventHandlerMap = {
  [K in EditorEvent]: Set<(...args: unknown[]) => void>;
};

export class CM5EditorEngine implements IEditorEngine {
  private instance: CM5EditorInstance | null = null;
  private readonly eventHandlers: Partial<EventHandlerMap> = {};

  private readonly cm5ChangeHandler = (): void => {
    this.emit('change', this.getValue());
  };

  private readonly cm5ScrollHandler = (): void => {
    this.emit('scroll', this.getScrollInfo());
  };

  private readonly cm5FocusHandler = (): void => {
    this.emit('focus');
  };

  private readonly cm5BlurHandler = (): void => {
    this.emit('blur');
  };

  private readonly cm5CursorHandler = (): void => {
    this.emit('cursorActivity', this.getCursor());
  };

  initialize(container: HTMLElement, initialValue = '', _extensions: unknown[] = []): void {
    const factory = (window as WindowWithCM5).CodeMirror;
    if (!factory) {
      throw new Error('CodeMirror 5 is not loaded');
    }

    this.instance = factory(container, {
      value: initialValue,
      mode: 'markdown',
      lineWrapping: true,
      lineNumbers: false,
      keyMap: 'default',
      cursorScrollMargin: 120,
    });

    this.instance.on('change', this.cm5ChangeHandler);
    this.instance.on('scroll', this.cm5ScrollHandler);
    this.instance.on('focus', this.cm5FocusHandler);
    this.instance.on('blur', this.cm5BlurHandler);
    this.instance.on('cursorActivity', this.cm5CursorHandler);
  }

  getValue(): string {
    return this.instance?.getValue() ?? '';
  }

  setValue(value: string): void {
    this.instance?.setValue(value);
  }

  getCursor(): CursorPosition {
    if (!this.instance) {
      return { line: 0, ch: 0 };
    }

    return this.instance.getCursor();
  }

  setCursor(pos: CursorPosition): void {
    this.instance?.setCursor(pos);
  }

  getScrollInfo(): ScrollInfo {
    if (!this.instance) {
      return { top: 0, height: 0, clientHeight: 0 };
    }

    return this.instance.getScrollInfo();
  }

  scrollTo(top: number): void {
    this.instance?.scrollTo(null, top);
  }

  focus(): void {
    this.instance?.focus();
  }

  hasFocus(): boolean {
    return this.instance?.hasFocus() ?? false;
  }

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

  off(event: EditorEvent, handler: (...args: unknown[]) => void): void {
    this.eventHandlers[event]?.delete(handler);
  }

  destroy(): void {
    if (this.instance) {
      this.instance.off('change', this.cm5ChangeHandler);
      this.instance.off('scroll', this.cm5ScrollHandler);
      this.instance.off('focus', this.cm5FocusHandler);
      this.instance.off('blur', this.cm5BlurHandler);
      this.instance.off('cursorActivity', this.cm5CursorHandler);

      const wrapper = this.instance.getWrapperElement();
      wrapper.remove();
      this.instance = null;
    }

    for (const handlers of Object.values(this.eventHandlers)) {
      handlers?.clear();
    }
  }

  private emit(event: EditorEvent, ...args: unknown[]): void {
    const handlers = this.eventHandlers[event];
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(...args);
    }
  }
}
