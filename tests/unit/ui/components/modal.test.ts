import { describe, expect, it } from 'vitest';
import { Modal } from '../../../../src/ui/components/modal';

describe('Modal component', () => {
  it('opens and closes with aria state updates', () => {
    document.body.innerHTML = `
      <div id="modal" class="modal" aria-hidden="true">
        <div role="dialog" aria-modal="true">
          <button id="first">First</button>
          <button id="second">Second</button>
        </div>
      </div>
    `;

    const root = document.getElementById('modal') as HTMLElement;
    const modal = new Modal(root, { initialFocusSelector: '#first' });

    modal.open();
    expect(root.getAttribute('aria-hidden')).toBe('false');
    expect(root.classList.contains('show')).toBe(true);
    expect((document.activeElement as HTMLElement).id).toBe('first');

    modal.close();
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.classList.contains('show')).toBe(false);
  });
});
