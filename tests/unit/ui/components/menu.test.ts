import { describe, expect, it } from 'vitest';
import { Menu } from '../../../../src/ui/components/menu';

describe('Menu component', () => {
  it('toggles visibility and supports keyboard navigation', () => {
    document.body.innerHTML = `
      <button id="trigger" aria-expanded="false">Menu</button>
      <nav id="menu" class="action-menu" aria-hidden="true">
        <button class="menu-item" id="item-1">One</button>
        <button class="menu-item" id="item-2">Two</button>
      </nav>
    `;

    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    const menuElement = document.getElementById('menu') as HTMLElement;
    const menu = new Menu(menuElement, trigger);

    menu.open();
    expect(menuElement.getAttribute('aria-hidden')).toBe('false');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect((document.activeElement as HTMLElement).id).toBe('item-2');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menuElement.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    menu.destroy();
  });
});
