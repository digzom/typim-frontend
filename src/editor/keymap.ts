/**
 * Keyboard shortcuts for CodeMirror 6
 * @module editor/keymap
 */

import { type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { StateManager } from '../core/state';
import { isModifierPressed } from '../utils/dom';
import type { UICommandId } from '../ui/commands/registry';

type CtrlWReason = 'editor-active' | 'modal-open' | 'non-editor-target';

export interface CtrlWGuardResult {
  intercepted: boolean;
  commandId: 'editor.deletePreviousWord' | 'none';
  reason: CtrlWReason;
}

interface CtrlWGuardInput {
  keyboardEvent: KeyboardEvent;
  editorHasFocus: boolean;
  modalOpen: boolean;
  target: EventTarget | null;
}

interface GlobalKeybindingOptions {
  editorHasFocus?: () => boolean;
  executeCommand: (commandId: UICommandId) => boolean;
}

interface KeymapOptions {
  executeCommand: (commandId: UICommandId) => boolean;
}

function isEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest('#editor, .cm-editor, .cm-content, .CodeMirror') !== null;
}

function shouldHandleCtrlW(event: KeyboardEvent): boolean {
  if (!isModifierPressed(event) || event.shiftKey || event.altKey) {
    return false;
  }

  return event.key.toLowerCase() === 'w';
}

export function evaluateCtrlWGuard(input: CtrlWGuardInput): CtrlWGuardResult {
  const { keyboardEvent, editorHasFocus, modalOpen, target } = input;

  if (modalOpen) {
    return { intercepted: false, commandId: 'none', reason: 'modal-open' };
  }

  const eventTarget = target ?? keyboardEvent.target ?? document.activeElement;
  if (!editorHasFocus || !isEditorTarget(eventTarget)) {
    return { intercepted: false, commandId: 'none', reason: 'non-editor-target' };
  }

  return { intercepted: true, commandId: 'editor.deletePreviousWord', reason: 'editor-active' };
}

function isModalOpen(stateManager: StateManager): boolean {
  if (stateManager.getState().ui.activeModal !== null) {
    return true;
  }

  return document.querySelector('.modal[aria-hidden="false"]') !== null;
}

function withModalGuard(stateManager: StateManager, callback: () => boolean): () => boolean {
  return () => {
    if (isModalOpen(stateManager)) {
      return false;
    }

    return callback();
  };
}

/**
 * Create keyboard shortcut extensions
 * @param stateManager - State manager instance
 * @returns Keymap extension
 */
export function createKeymapExtensions(
  stateManager: StateManager,
  options: KeymapOptions
): Extension {
  return keymap.of([
    {
      key: 'Mod-s',
      run: withModalGuard(stateManager, () => options.executeCommand('file.save')),
      preventDefault: true,
    },
    {
      key: 'Mod-o',
      run: withModalGuard(stateManager, () => options.executeCommand('file.open')),
      preventDefault: true,
    },
    {
      key: 'Mod-\\',
      run: withModalGuard(stateManager, () => options.executeCommand('ui.toggleSplit')),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-f',
      run: withModalGuard(stateManager, () => {
        stateManager.dispatch({ type: 'UI_SET_LAYOUT', payload: 'focus' });
        return true;
      }),
      preventDefault: true,
    },
    {
      key: 'Ctrl-Escape',
      run: withModalGuard(stateManager, () => {
        const state = stateManager.getState();
        if (state.ui.layout === 'focus') {
          stateManager.dispatch({ type: 'UI_SET_LAYOUT', payload: 'split' });
        }
        return true;
      }),
    },
    {
      key: 'Mod-Shift-v',
      run: withModalGuard(stateManager, () => options.executeCommand('editor.toggleVim')),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-d',
      run: withModalGuard(stateManager, () => options.executeCommand('ui.toggleTheme')),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-l',
      run: withModalGuard(stateManager, () => options.executeCommand('editor.toggleLiveMarkdown')),
      preventDefault: true,
    },
    {
      key: 'Mod-w',
      run: withModalGuard(stateManager, () => options.executeCommand('editor.deletePreviousWord')),
      preventDefault: true,
    },
  ]);
}

/**
 * Set up global keyboard shortcuts (outside editor)
 * @param stateManager - State manager instance
 * @returns Cleanup function
 */
export function setupGlobalKeybindings(
  stateManager: StateManager,
  options: GlobalKeybindingOptions
): () => void {
  const handler = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (shouldHandleCtrlW(event)) {
      const decision = evaluateCtrlWGuard({
        keyboardEvent: event,
        editorHasFocus: options.editorHasFocus?.() ?? isEditorTarget(document.activeElement),
        modalOpen: isModalOpen(stateManager),
        target: event.target,
      });

      if (decision.intercepted) {
        event.preventDefault();
        options.executeCommand('editor.deletePreviousWord');
      }

      return;
    }

    if (isModalOpen(stateManager) && event.key !== 'Escape') {
      event.preventDefault();
      return;
    }

    if (event.key === 'F1') {
      event.preventDefault();
      options.executeCommand('ui.openShortcutsGuide');
      return;
    }

    if (isModifierPressed(event) && (key === '/' || key === '?')) {
      event.preventDefault();
      options.executeCommand('ui.openShortcutsGuide');
      return;
    }

    if (isModifierPressed(event) && event.shiftKey && key === 'm') {
      event.preventDefault();
      options.executeCommand('ui.openFonts');
      return;
    }

    if (isModifierPressed(event) && event.shiftKey && key === 's') {
      event.preventDefault();
      options.executeCommand('ui.openShare');
    }
  };

  document.addEventListener('keydown', handler);

  return () => {
    document.removeEventListener('keydown', handler);
  };
}
