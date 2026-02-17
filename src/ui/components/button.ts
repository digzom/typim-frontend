type ClickHandler = (event: MouseEvent) => void;

export class Button {
  private clickHandler: ClickHandler | null = null;

  constructor(private readonly element: HTMLButtonElement) {}

  setLabel(label: string): void {
    this.element.textContent = label;
  }

  setDisabled(disabled: boolean): void {
    this.element.disabled = disabled;
  }

  onClick(handler: ClickHandler): void {
    if (this.clickHandler) {
      this.element.removeEventListener('click', this.clickHandler);
    }

    this.clickHandler = handler;
    this.element.addEventListener('click', handler);
  }

  focus(): void {
    this.element.focus();
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }

  destroy(): void {
    if (this.clickHandler) {
      this.element.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }
}
