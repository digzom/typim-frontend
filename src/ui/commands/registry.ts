import type { StateManager } from '../../core/state';
import type { Theme } from '../../core/types';
import type { LayoutManager } from '../layout';
import { isFeatureEnabled } from '../../core/config';
import { openFile, saveFile } from '../../features/files';

export type UICommandId =
  | 'file.open'
  | 'file.save'
  | 'ui.toggleSplit'
  | 'editor.toggleVim'
  | 'editor.toggleLiveMarkdown'
  | 'ui.toggleTheme'
  | 'ui.openFonts'
  | 'ui.openShortcutsGuide'
  | 'ui.openShare'
  | 'editor.deletePreviousWord';

export interface UICommandContext {
  stateManager: StateManager;
  layoutManager: LayoutManager;
  openModal: (name: 'share' | 'fonts' | 'shortcuts') => void;
  closeMenu: () => void;
  deletePreviousWord: () => boolean;
}

export interface UICommandDefinition {
  id: UICommandId;
  menuElementId?: string;
  shortcuts: string[];
  getLabel: (context: UICommandContext) => string;
  execute: (context: UICommandContext) => boolean;
}

const COMMANDS: readonly UICommandDefinition[] = [
  {
    id: 'file.open',
    menuElementId: 'menu-open',
    shortcuts: ['Mod-o'],
    getLabel: () => 'Open',
    execute: context => {
      openFile(context.stateManager);
      return true;
    },
  },
  {
    id: 'file.save',
    menuElementId: 'menu-save',
    shortcuts: ['Mod-s'],
    getLabel: () => 'Save',
    execute: context => {
      saveFile(context.stateManager);
      return true;
    },
  },
  {
    id: 'ui.toggleSplit',
    menuElementId: 'menu-split',
    shortcuts: ['Mod-\\'],
    getLabel: context => {
      const state = context.stateManager.getState();
      if (context.layoutManager.isMobile()) {
        return state.ui.mobilePane === 'editor' ? 'Preview' : 'Editor';
      }

      return state.ui.layout === 'split' ? 'Single' : 'Split';
    },
    execute: context => {
      const state = context.stateManager.getState();
      if (context.layoutManager.isMobile()) {
        const nextPane = state.ui.mobilePane === 'editor' ? 'preview' : 'editor';
        context.stateManager.dispatch({ type: 'UI_SET_MOBILE_PANE', payload: nextPane });
        return true;
      }

      const nextLayout = state.ui.layout === 'split' ? 'single' : 'split';
      context.layoutManager.setMode(nextLayout);
      return true;
    },
  },
  {
    id: 'editor.toggleVim',
    menuElementId: 'menu-vim',
    shortcuts: ['Mod-Shift-v'],
    getLabel: context => `Vim: ${context.stateManager.getState().editor.vimMode ? 'On' : 'Off'}`,
    execute: context => {
      context.stateManager.dispatch({ type: 'EDITOR_TOGGLE_VIM' });
      return true;
    },
  },
  {
    id: 'editor.toggleLiveMarkdown',
    menuElementId: 'menu-livemd',
    shortcuts: ['Mod-Shift-l'],
    getLabel: context =>
      `Live MD: ${context.stateManager.getState().editor.liveMarkdown ? 'On' : 'Off'}`,
    execute: context => {
      if (!isFeatureEnabled('useLiveMarkdown')) {
        return false;
      }

      context.stateManager.dispatch({ type: 'EDITOR_TOGGLE_LIVE_MD' });
      return true;
    },
  },
  {
    id: 'ui.toggleTheme',
    menuElementId: 'menu-theme',
    shortcuts: ['Mod-Shift-d'],
    getLabel: context => {
      const theme = context.stateManager.getState().ui.theme;
      return `Theme: ${theme.charAt(0).toUpperCase()}${theme.slice(1)}`;
    },
    execute: context => {
      const currentTheme = context.stateManager.getState().ui.theme;
      const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
      context.stateManager.dispatch({ type: 'UI_SET_THEME', payload: nextTheme });
      return true;
    },
  },
  {
    id: 'ui.openFonts',
    menuElementId: 'menu-fonts',
    shortcuts: ['Mod-Shift-m'],
    getLabel: () => 'Fonts',
    execute: context => {
      context.openModal('fonts');
      return true;
    },
  },
  {
    id: 'ui.openShortcutsGuide',
    menuElementId: 'menu-shortcuts',
    shortcuts: ['Mod-/', 'F1'],
    getLabel: () => 'Shortcuts',
    execute: context => {
      context.openModal('shortcuts');
      return true;
    },
  },
  {
    id: 'ui.openShare',
    menuElementId: 'menu-share',
    shortcuts: ['Mod-Shift-s'],
    getLabel: () => 'Share',
    execute: context => {
      context.openModal('share');
      return true;
    },
  },
  {
    id: 'editor.deletePreviousWord',
    shortcuts: ['Mod-w', 'Alt-Backspace'],
    getLabel: () => 'Delete previous word',
    execute: context => context.deletePreviousWord(),
  },
] as const;

export function getCommandRegistry(): readonly UICommandDefinition[] {
  return COMMANDS;
}

export function getCommand(commandId: UICommandId): UICommandDefinition | undefined {
  return COMMANDS.find(command => command.id === commandId);
}

export function getMenuCommand(menuElementId: string): UICommandDefinition | undefined {
  return COMMANDS.find(command => command.menuElementId === menuElementId);
}

export function executeCommand(
  commandId: UICommandId,
  context: UICommandContext
): { executed: boolean; blockedReason?: string } {
  const command = getCommand(commandId);
  if (!command) {
    return { executed: false, blockedReason: 'unknown-command' };
  }

  const executed = command.execute(context);
  if (!executed) {
    return { executed: false, blockedReason: 'command-blocked' };
  }

  return { executed: true };
}

export function getPrimaryShortcut(commandId: UICommandId): string | null {
  const command = getCommand(commandId);
  return command?.shortcuts[0] ?? null;
}
