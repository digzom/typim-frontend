import { describe, expect, it } from 'vitest';
import { evaluateCtrlWGuard } from '../../../src/editor/keymap';

function ctrlWEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'w',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
}

describe('Ctrl/Cmd+W guard evaluator', () => {
  it('blocks when modal is open before editor checks', () => {
    const target = document.createElement('div');
    target.className = 'cm-content';

    const result = evaluateCtrlWGuard({
      keyboardEvent: ctrlWEvent(),
      editorHasFocus: true,
      modalOpen: true,
      target,
    });

    expect(result).toEqual({ intercepted: false, commandId: 'none', reason: 'modal-open' });
  });

  it('blocks when event target is outside editor context', () => {
    const target = document.createElement('input');

    const result = evaluateCtrlWGuard({
      keyboardEvent: ctrlWEvent(),
      editorHasFocus: true,
      modalOpen: false,
      target,
    });

    expect(result).toEqual({ intercepted: false, commandId: 'none', reason: 'non-editor-target' });
  });

  it('intercepts in editor context regardless of vim mode', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-editor';
    const content = document.createElement('div');
    content.className = 'cm-content';
    wrapper.appendChild(content);

    const result = evaluateCtrlWGuard({
      keyboardEvent: ctrlWEvent(),
      editorHasFocus: true,
      modalOpen: false,
      target: content,
    });

    expect(result).toEqual({
      intercepted: true,
      commandId: 'editor.deletePreviousWord',
      reason: 'editor-active',
    });
  });

  it('intercepts with editor.deletePreviousWord in active editor context', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-editor';
    const content = document.createElement('div');
    content.className = 'cm-content';
    wrapper.appendChild(content);

    const result = evaluateCtrlWGuard({
      keyboardEvent: ctrlWEvent(),
      editorHasFocus: true,
      modalOpen: false,
      target: content,
    });

    expect(result).toEqual({
      intercepted: true,
      commandId: 'editor.deletePreviousWord',
      reason: 'editor-active',
    });
  });
});
