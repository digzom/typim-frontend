interface ModalOptions {
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusSelector?: string;
}

type ModalCallback = () => void;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export class Modal {
  private readonly options: Required<ModalOptions>;
  private readonly onOpenCallbacks: Set<ModalCallback> = new Set();
  private readonly onCloseCallbacks: Set<ModalCallback> = new Set();
  private isOpen = false;
  private previousActiveElement: HTMLElement | null = null;

  private readonly handleBackdropClick = (event: MouseEvent): void => {
    if (!this.options.closeOnBackdrop || event.target !== this.rootElement) {
      return;
    }

    this.close();
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!this.isOpen) {
      return;
    }

    if (event.key === 'Escape' && this.options.closeOnEscape) {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  };

  constructor(
    private readonly rootElement: HTMLElement,
    options: ModalOptions = {}
  ) {
    this.options = {
      closeOnBackdrop: options.closeOnBackdrop ?? true,
      closeOnEscape: options.closeOnEscape ?? true,
      initialFocusSelector: options.initialFocusSelector ?? '',
    };

    this.rootElement.addEventListener('click', this.handleBackdropClick);
  }

  open(): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    this.rootElement.classList.add('show');
    this.rootElement.setAttribute('aria-hidden', 'false');

    document.addEventListener('keydown', this.handleKeydown, true);
    this.focusInitialElement();

    for (const callback of this.onOpenCallbacks) {
      callback();
    }
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;

    this.rootElement.classList.remove('show');
    this.rootElement.setAttribute('aria-hidden', 'true');

    document.removeEventListener('keydown', this.handleKeydown, true);

    if (this.previousActiveElement) {
      this.previousActiveElement.focus();
      this.previousActiveElement = null;
    }

    for (const callback of this.onCloseCallbacks) {
      callback();
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  onOpen(callback: ModalCallback): () => void {
    this.onOpenCallbacks.add(callback);
    return () => {
      this.onOpenCallbacks.delete(callback);
    };
  }

  onClose(callback: ModalCallback): () => void {
    this.onCloseCallbacks.add(callback);
    return () => {
      this.onCloseCallbacks.delete(callback);
    };
  }

  destroy(): void {
    this.close();
    this.rootElement.removeEventListener('click', this.handleBackdropClick);
    this.onOpenCallbacks.clear();
    this.onCloseCallbacks.clear();
  }

  private focusInitialElement(): void {
    if (this.options.initialFocusSelector) {
      const initial = this.rootElement.querySelector<HTMLElement>(
        this.options.initialFocusSelector
      );
      if (initial) {
        initial.focus();
        return;
      }
    }

    const focusables = this.getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
      return;
    }

    const modalCard = this.rootElement.querySelector<HTMLElement>('[role="dialog"]');
    modalCard?.focus();
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusables = this.getFocusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || active === this.rootElement) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    return Array.from(this.rootElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
    );
  }
}
