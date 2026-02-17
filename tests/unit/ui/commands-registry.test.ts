import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/core/event-bus';
import { StateManager } from '../../../src/core/state';
import { StorageAdapter } from '../../../src/utils/storage';
import {
  executeCommand,
  getCommand,
  getCommandRegistry,
  getMenuCommand,
  type UICommandContext,
} from '../../../src/ui/commands/registry';

function createContext(): UICommandContext {
  const stateManager = new StateManager(new StorageAdapter(), new EventBus());

  return {
    stateManager,
    layoutManager: {
      isMobile: () => false,
      setMode: mode => {
        stateManager.dispatch({ type: 'UI_SET_LAYOUT', payload: mode });
        return true;
      },
      getMode: () => stateManager.getState().ui.layout,
      setSplitRatio: ratio => {
        stateManager.dispatch({ type: 'UI_SET_SPLIT_RATIO', payload: ratio });
      },
      getSplitRatio: () => stateManager.getState().ui.splitRatio,
      destroy: () => undefined,
    } as UICommandContext['layoutManager'],
    openModal: modal => {
      stateManager.dispatch({ type: 'UI_SET_MODAL', payload: modal });
    },
    closeMenu: () => undefined,
    deletePreviousWord: () => true,
  };
}

describe('UI command registry', () => {
  it('keeps one-to-one parity between menu actions and command ids with shortcuts', () => {
    const commands = getCommandRegistry();
    const menuCommands = commands.filter(command => command.menuElementId);

    expect(menuCommands.length).toBe(9);
    expect(new Set(menuCommands.map(command => command.menuElementId)).size).toBe(
      menuCommands.length
    );
    expect(menuCommands.every(command => command.shortcuts.length > 0)).toBe(true);

    const shortcutsCommand = getCommand('ui.openShortcutsGuide');
    expect(shortcutsCommand?.shortcuts).toContain('Mod-/');
    expect(shortcutsCommand?.shortcuts).toContain('F1');
  });

  it('is idempotent across repeated initialization and command lookups', () => {
    const first = getCommandRegistry();
    const second = getCommandRegistry();

    expect(first).toEqual(second);

    const menuIds = [
      'menu-open',
      'menu-save',
      'menu-split',
      'menu-vim',
      'menu-livemd',
      'menu-theme',
      'menu-fonts',
      'menu-shortcuts',
      'menu-share',
    ];

    expect(menuIds.map(menuId => getMenuCommand(menuId)?.id)).toEqual([
      'file.open',
      'file.save',
      'ui.toggleSplit',
      'editor.toggleVim',
      'editor.toggleLiveMarkdown',
      'ui.toggleTheme',
      'ui.openFonts',
      'ui.openShortcutsGuide',
      'ui.openShare',
    ]);
  });

  it('executes command ids without changing state action contracts', () => {
    const context = createContext();
    const beforeTheme = context.stateManager.getState().ui.theme;

    const result = executeCommand('ui.toggleTheme', context);

    expect(result.executed).toBe(true);
    expect(context.stateManager.getState().ui.theme).not.toBe(beforeTheme);
  });
});
