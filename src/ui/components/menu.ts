interface MenuOptions {
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}

export class Menu {
  private readonly options: Required<MenuOptions>;
  private isOpen = false;

  private readonly handleTriggerClick = (event: MouseEvent): void => {
    event.stopPropagation();
    this.toggle();
  };

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    if (!this.options.closeOnOutsideClick || !this.isOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (this.menuElement.contains(target) || this.triggerElement.contains(target)) {
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
      this.triggerElement.focus();
      return;
    }

    const items = this.getMenuItems();
    if (items.length === 0) {
      return;
    }

    const activeIndex = items.findIndex(item => item === document.activeElement);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
        items[nextIndex].focus();
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        const nextIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
        items[nextIndex].focus();
        break;
      }

      case 'Home':
        event.preventDefault();
        items[0].focus();
        break;

      case 'End':
        event.preventDefault();
        items[items.length - 1].focus();
        break;

      default:
        break;
    }
  };

  constructor(
    private readonly menuElement: HTMLElement,
    private readonly triggerElement: HTMLButtonElement,
    options: MenuOptions = {}
  ) {
    this.options = {
      closeOnOutsideClick: options.closeOnOutsideClick ?? true,
      closeOnEscape: options.closeOnEscape ?? true,
    };

    this.triggerElement.addEventListener('click', this.handleTriggerClick);
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeydown);
  }

  open(): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.menuElement.classList.add('show');
    this.menuElement.setAttribute('aria-hidden', 'false');
    this.triggerElement.setAttribute('aria-expanded', 'true');

    const firstItem = this.getMenuItems()[0];
    firstItem?.focus();
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.menuElement.classList.remove('show');
    this.menuElement.setAttribute('aria-hidden', 'true');
    this.triggerElement.setAttribute('aria-expanded', 'false');
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy(): void {
    this.close();
    this.triggerElement.removeEventListener('click', this.handleTriggerClick);
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private getMenuItems(): HTMLButtonElement[] {
    return Array.from(this.menuElement.querySelectorAll<HTMLButtonElement>('button.menu-item'));
  }
}
