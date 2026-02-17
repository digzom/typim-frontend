/**
 * File operations module
 * Open and save markdown files
 * @module features/files
 */

import type { StateManager } from '../../core/state';
import { Logger } from '../../core/errors';

const logger = new Logger('production');

/**
 * Trigger file open dialog
 * @param stateManager - State manager instance
 */
export function openFile(stateManager: StateManager): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.markdown,.txt';

  input.onchange = (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        // Update state with file content
        stateManager.dispatch({ type: 'EDITOR_SET_CONTENT', payload: result });

        // Update title from filename
        const title = file.name.replace(/\.[^/.]+$/, '');
        stateManager.dispatch({ type: 'EDITOR_SET_TITLE', payload: title });

        logger.info('File opened', { filename: file.name });
      }
    };
    reader.onerror = () => {
      const error = reader.error ? new Error(reader.error.message) : undefined;
      logger.error('Failed to read file', error);
      alert('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  };

  input.click();
}

/**
 * Save current document to file
 * @param stateManager - State manager instance
 */
export function saveFile(stateManager: StateManager): void {
  const state = stateManager.getState();
  const content = state.editor.content;
  const title = state.editor.title || 'Untitled';

  // Ensure content is valid markdown (INV-001)
  if (typeof content !== 'string') {
    logger.error('Invalid content type for save', undefined, { type: typeof content });
    return;
  }

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title}.md`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  logger.info('File saved', { title });
}
