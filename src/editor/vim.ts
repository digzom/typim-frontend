/**
 * Vim mode integration for CodeMirror 6
 * @module editor/vim
 */

import { Vim, vim } from '@replit/codemirror-vim';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { setLineNumberMode } from './cm6/setup';

let vimEnabled = false;
let vimExtension: Extension | null = null;
let vimOptionsInitialized = false;
const relativeNumberCleanup = new WeakMap<object, () => void>();

function attachRelativeNumberTracking(cm: {
  cm6?: EditorView;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
}): void {
  if (relativeNumberCleanup.has(cm)) {
    return;
  }

  const handler = () => {
    if (!cm.cm6) {
      return;
    }

    // Force gutter recompute as cursor moves in normal mode.
    setLineNumberMode(cm.cm6, 'relative');
  };

  cm.on('cursorActivity', handler);
  relativeNumberCleanup.set(cm, () => {
    cm.off('cursorActivity', handler);
  });
}

function detachRelativeNumberTracking(cm: object): void {
  const cleanup = relativeNumberCleanup.get(cm);
  if (!cleanup) {
    return;
  }

  cleanup();
  relativeNumberCleanup.delete(cm);
}

function ensureVimOptions(): void {
  if (vimOptionsInitialized) {
    return;
  }

  vimOptionsInitialized = true;

  Vim.defineOption('relativenumber', false, 'boolean', ['rnu'], (value = false, cm) => {
    if (!cm?.cm6) {
      return;
    }

    setLineNumberMode(cm.cm6, value ? 'relative' : 'absolute');

    if (value) {
      attachRelativeNumberTracking(cm);
      return;
    }

    detachRelativeNumberTracking(cm);
  });
}

/**
 * Get Vim extension (lazy loaded)
 * @returns Vim extension
 */
function getVimExtension(): Extension {
  ensureVimOptions();

  if (!vimExtension) {
    vimExtension = vim({
      status: true,
    });
  }
  return vimExtension;
}

/**
 * Check if Vim mode is enabled
 * @returns True if Vim mode is enabled
 */
export function isVimEnabled(): boolean {
  return vimEnabled;
}

/**
 * Create Vim extension for editor
 * @param enabled - Whether to enable Vim mode
 * @returns Array of extensions
 */
export function createVimExtensions(enabled: boolean): Extension[] {
  vimEnabled = enabled;
  if (enabled) {
    return [getVimExtension()];
  }
  return [];
}

/**
 * Toggle Vim mode state for active editor configuration
 * @param _view - EditorView instance (managed via compartment reconfigure)
 * @param enabled - Whether to enable Vim mode
 * @returns True if toggle successful
 */
export function toggleVim(_view: EditorView, enabled: boolean): boolean {
  vimEnabled = enabled;
  return true;
}

/**
 * Handle Ctrl+W in Vim mode
 * In Vim, Ctrl+W is used for window commands, not delete-word-before
 * @returns True if handled by Vim
 */
export function handleVimCtrlW(): boolean {
  if (!vimEnabled) return false;

  // In Vim mode, let Vim handle Ctrl+W
  // The Vim extension will process it as a window command
  return true;
}

/**
 * Get Vim status string for UI
 * @returns Status string
 */
export function getVimStatus(): string {
  return vimEnabled ? 'On' : 'Off';
}
