import './styles/main.css';

import { CONFIG, isFeatureEnabled } from './core/config';
import { deleteGroupBackward } from '@codemirror/commands';
import type { Extension } from '@codemirror/state';
import type { Cm6FenceLanguageRegistryV1 } from './editor/cm6/extensions/fence-language-registry';
import { EventBus } from './core/event-bus';
import { Logger, setupGlobalErrorHandling } from './core/errors';
import { StateManager } from './core/state';
import type { SharePayload, Theme } from './core/types';
import { Compartment } from '@codemirror/state';
import { CM6EditorEngine } from './editor/cm6';
import { CM5EditorEngine, ensureCM5Loaded } from './editor/cm5-adapter';
import { createLiveMarkdownExtension } from './editor/cm6/extensions/live-markdown';
import { createSemanticMarkdownVisibilityExtension } from './editor/cm6/extensions/semantic-markdown';
import { getThemeExtension } from './editor/cm6/theme';
import { createKeymapExtensions, setupGlobalKeybindings } from './editor/keymap';
import { LiveMarkdownEngine } from './editor/live-markdown/engine';
import { createVimExtensions } from './editor/vim';
import { ShareClient } from './features/share/client';
import { ThemeManager } from './features/theme';
import { TypographySystem } from './styles/typography';
import { LayoutManager } from './ui/layout';
import { createPreviewRenderer } from './ui/preview';
import { ScrollCoordinator } from './ui/scroll-sync';
import { Modal } from './ui/components/modal';
import { Menu } from './ui/components/menu';
import { renderMarkdownWithSourceMap } from './utils/markdown';
import {
  executeCommand,
  getCommandRegistry,
  getMenuCommand,
  getPrimaryShortcut,
  type UICommandContext,
  type UICommandId,
} from './ui/commands/registry';
import { StorageAdapter } from './utils/storage';

interface AppElements {
  editor: HTMLElement;
  preview: HTMLElement;
  menuButton: HTMLButtonElement;
  actionMenu: HTMLElement;
  menuOpen: HTMLButtonElement;
  menuSave: HTMLButtonElement;
  menuSplit: HTMLButtonElement;
  menuVim: HTMLButtonElement;
  menuLiveMarkdown: HTMLButtonElement;
  menuTheme: HTMLButtonElement;
  menuFonts: HTMLButtonElement;
  menuShortcuts: HTMLButtonElement;
  menuShare: HTMLButtonElement;
  docTitle: HTMLInputElement;
  shareModal: HTMLElement;
  fontModal: HTMLElement;
  shortcutsModal: HTMLElement;
  shareCreate: HTMLButtonElement;
  shareUpdate: HTMLButtonElement;
  shareType: HTMLSelectElement;
  sharePrivacy: HTMLSelectElement;
  shareUrl: HTMLInputElement;
  shareCopy: HTMLButtonElement;
  shareError: HTMLElement;
  shareClose: HTMLButtonElement;
  fontClose: HTMLButtonElement;
  shortcutsClose: HTMLButtonElement;
}

interface TypimWindow extends Window {
  typim?: TypimDiagnostics;
}

interface TypimDiagnostics {
  readonly config: typeof CONFIG;
  readonly state: StateManager;
  readonly events: EventBus;
  readonly storage: StorageAdapter;
  readonly layout: LayoutManager;
  readonly theme: ThemeManager;
  readonly ready: boolean;
  readonly initStatus: 'initializing' | 'ready';
  readonly editor: CM6EditorEngine | CM5EditorEngine;
  whenReady(): Promise<TypimDiagnostics>;
  readonly scroll: ScrollCoordinator | null;
}

const logger = new Logger(CONFIG.environment);
setupGlobalErrorHandling(logger);

const eventBus = new EventBus();
const storage = new StorageAdapter();
const stateManager = new StateManager(storage, eventBus);
const themeManager = new ThemeManager(stateManager, storage);
const typographySystem = new TypographySystem(stateManager, storage);
const layoutManager = new LayoutManager(stateManager);
const shareClient = new ShareClient();

let editorEngine: CM6EditorEngine | CM5EditorEngine | null = null;
let liveMarkdownEngine: LiveMarkdownEngine | null = null;
let scrollCoordinator: ScrollCoordinator | null = null;
let menu: Menu | null = null;
let globalKeybindingsCleanup: (() => void) | null = null;
let appElementsRef: AppElements | null = null;
let previewRendererRef: ReturnType<typeof createPreviewRenderer> | null = null;
let createMarkdownExtensionRef:
  | ((options?: {
      enableFenceHighlighting?: boolean;
      registry?: Cm6FenceLanguageRegistryV1;
    }) => Extension)
  | null = null;
let cm6FenceLanguageRegistryRef: Cm6FenceLanguageRegistryV1 | null = null;
let diagnosticsReady = false;
let resolveDiagnosticsReady: (() => void) | null = null;
let rejectDiagnosticsReady: ((reason?: unknown) => void) | null = null;
const diagnosticsReadyPromise = new Promise<void>((resolve, reject) => {
  resolveDiagnosticsReady = resolve;
  rejectDiagnosticsReady = reject;
});

const themeCompartment = new Compartment();
const vimCompartment = new Compartment();
const liveMarkdownCompartment = new Compartment();
const markdownCompartment = new Compartment();

export type LiveMarkdownGateReason = 'enabled' | 'feature-disabled' | 'state-disabled' | 'vim-mode';
export type FenceHighlightGateReason =
  | 'enabled'
  | 'cm5-engine'
  | 'feature-disabled'
  | 'live-markdown-active';

export function resolveLiveMarkdownModeGate(
  featureFlagUseLiveMarkdown: boolean,
  stateLiveMarkdown: boolean,
  _stateVimMode: boolean
): { attachExtensions: boolean; reason: LiveMarkdownGateReason } {
  if (!featureFlagUseLiveMarkdown) {
    return { attachExtensions: false, reason: 'feature-disabled' };
  }

  if (!stateLiveMarkdown) {
    return { attachExtensions: false, reason: 'state-disabled' };
  }

  return { attachExtensions: true, reason: 'enabled' };
}

export function resolveFenceHighlightGate(
  useCM6: boolean,
  useFenceHighlighting: boolean,
  liveMarkdownEnabled: boolean
): { attachFenceHighlighting: boolean; reason: FenceHighlightGateReason } {
  if (!useCM6) {
    return { attachFenceHighlighting: false, reason: 'cm5-engine' };
  }

  if (!useFenceHighlighting) {
    return { attachFenceHighlighting: false, reason: 'feature-disabled' };
  }

  if (liveMarkdownEnabled) {
    return { attachFenceHighlighting: false, reason: 'live-markdown-active' };
  }

  return { attachFenceHighlighting: true, reason: 'enabled' };
}

const modalRegistry = new Map<string, Modal>();

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function queryElement<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function getAppElements(): AppElements | null {
  const editor = queryElement<HTMLElement>('#editor');
  const preview = queryElement<HTMLElement>('#preview');
  const menuButton = queryElement<HTMLButtonElement>('#menu-btn');
  const actionMenu = queryElement<HTMLElement>('#action-menu');
  const menuOpen = queryElement<HTMLButtonElement>('#menu-open');
  const menuSave = queryElement<HTMLButtonElement>('#menu-save');
  const menuSplit = queryElement<HTMLButtonElement>('#menu-split');
  const menuVim = queryElement<HTMLButtonElement>('#menu-vim');
  const menuLiveMarkdown = queryElement<HTMLButtonElement>('#menu-livemd');
  const menuTheme = queryElement<HTMLButtonElement>('#menu-theme');
  const menuFonts = queryElement<HTMLButtonElement>('#menu-fonts');
  const menuShortcuts = queryElement<HTMLButtonElement>('#menu-shortcuts');
  const menuShare = queryElement<HTMLButtonElement>('#menu-share');
  const docTitle = queryElement<HTMLInputElement>('#doc-title');
  const shareModal = queryElement<HTMLElement>('#share-modal');
  const fontModal = queryElement<HTMLElement>('#font-modal');
  const shortcutsModal = queryElement<HTMLElement>('#shortcuts-modal');
  const shareCreate = queryElement<HTMLButtonElement>('#share-create');
  const shareUpdate = queryElement<HTMLButtonElement>('#share-update');
  const shareType = queryElement<HTMLSelectElement>('#share-type');
  const sharePrivacy = queryElement<HTMLSelectElement>('#share-privacy');
  const shareUrl = queryElement<HTMLInputElement>('#share-url');
  const shareCopy = queryElement<HTMLButtonElement>('#share-copy');
  const shareError = queryElement<HTMLElement>('#share-error');
  const shareClose = queryElement<HTMLButtonElement>('#share-close');
  const fontClose = queryElement<HTMLButtonElement>('#font-close');
  const shortcutsClose = queryElement<HTMLButtonElement>('#shortcuts-close');

  if (
    !editor ||
    !preview ||
    !menuButton ||
    !actionMenu ||
    !menuOpen ||
    !menuSave ||
    !menuSplit ||
    !menuVim ||
    !menuLiveMarkdown ||
    !menuTheme ||
    !menuFonts ||
    !menuShortcuts ||
    !menuShare ||
    !docTitle ||
    !shareModal ||
    !fontModal ||
    !shortcutsModal ||
    !shareCreate ||
    !shareUpdate ||
    !shareType ||
    !sharePrivacy ||
    !shareUrl ||
    !shareCopy ||
    !shareError ||
    !shareClose ||
    !fontClose ||
    !shortcutsClose
  ) {
    logger.error('Required DOM elements are missing.');
    return null;
  }

  return {
    editor,
    preview,
    menuButton,
    actionMenu,
    menuOpen,
    menuSave,
    menuSplit,
    menuVim,
    menuLiveMarkdown,
    menuTheme,
    menuFonts,
    menuShortcuts,
    menuShare,
    docTitle,
    shareModal,
    fontModal,
    shortcutsModal,
    shareCreate,
    shareUpdate,
    shareType,
    sharePrivacy,
    shareUrl,
    shareCopy,
    shareError,
    shareClose,
    fontClose,
    shortcutsClose,
  };
}

function syncMenuLabels(): void {
  const commandContext = createCommandContext();
  if (!commandContext) {
    return;
  }

  for (const command of getCommandRegistry()) {
    if (!command.menuElementId) {
      continue;
    }

    const menuButton = document.getElementById(command.menuElementId) as HTMLButtonElement | null;
    if (!menuButton) {
      continue;
    }

    const labelNode = menuButton.querySelector<HTMLElement>('.menu-item-label');
    const shortcutNode = menuButton.querySelector<HTMLElement>('.menu-item-shortcut');
    const commandLabel = command.getLabel(commandContext);
    const shortcut = getPrimaryShortcut(command.id);

    if (labelNode && shortcutNode) {
      labelNode.textContent = commandLabel;
      shortcutNode.textContent = formatShortcutForDisplay(shortcut);
    } else {
      menuButton.textContent = shortcut
        ? `${commandLabel} ${formatShortcutForDisplay(shortcut)}`
        : commandLabel;
    }
  }
}

function formatShortcutForDisplay(shortcut: string | null): string {
  if (!shortcut) {
    return '';
  }

  if (shortcut === 'F1') {
    return 'F1';
  }

  return shortcut
    .split('-')
    .map(segment => {
      if (segment === 'Mod') {
        return 'Ctrl/Cmd';
      }
      if (segment === 'Shift' || segment === 'Alt') {
        return segment;
      }
      if (segment.length === 1) {
        return segment.toUpperCase();
      }
      return segment;
    })
    .join(' + ');
}

function hydrateShareModalState(): void {
  if (!appElementsRef) {
    return;
  }

  const shareState = stateManager.getState().share;
  appElementsRef.shareType.value = shareState.type;
  appElementsRef.sharePrivacy.value = shareState.privacy;
  appElementsRef.shareUrl.value = shareState.url;
  appElementsRef.shareCopy.disabled = !shareState.url;
  appElementsRef.shareUpdate.disabled = !(
    shareState.type === 'live' && shareClient.getLiveSession()
  );
  appElementsRef.shareError.textContent = '';
}

function createCommandContext(): UICommandContext | null {
  if (!editorEngine) {
    return null;
  }

  return {
    stateManager,
    layoutManager,
    openModal,
    closeMenu: () => {
      menu?.close();
    },
    deletePreviousWord,
  };
}

function executeCommandById(commandId: UICommandId): boolean {
  const context = createCommandContext();
  if (!context) {
    return false;
  }

  const result = executeCommand(commandId, context);
  return result.executed;
}

function cursorToOffset(content: string, line: number, ch: number): number {
  const lines = content.split('\n');
  let offset = 0;

  for (let index = 0; index < line; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }

  return offset + ch;
}

function offsetToCursor(content: string, offset: number): { line: number; ch: number } {
  const boundedOffset = Math.max(0, Math.min(offset, content.length));
  const textBeforeCursor = content.slice(0, boundedOffset);
  const lines = textBeforeCursor.split('\n');
  return {
    line: lines.length - 1,
    ch: lines[lines.length - 1]?.length ?? 0,
  };
}

function deletePreviousWordFallback(): boolean {
  if (!editorEngine) {
    return false;
  }

  const content = editorEngine.getValue();
  const cursor = editorEngine.getCursor();
  const cursorOffset = cursorToOffset(content, cursor.line, cursor.ch);
  const beforeCursor = content.slice(0, cursorOffset);
  const afterCursor = content.slice(cursorOffset);
  const lastSegmentMatch = beforeCursor.match(/(?:\s*\S+|\s+)$/u);
  if (!lastSegmentMatch) {
    return false;
  }

  const deleteStart = beforeCursor.length - lastSegmentMatch[0].length;
  const nextContent = `${beforeCursor.slice(0, deleteStart)}${afterCursor}`;
  editorEngine.setValue(nextContent);
  editorEngine.setCursor(offsetToCursor(nextContent, deleteStart));
  return true;
}

function deletePreviousWord(): boolean {
  if (!editorEngine) {
    return false;
  }

  if (editorEngine instanceof CM6EditorEngine) {
    const view = editorEngine.getView();
    if (view) {
      return deleteGroupBackward(view);
    }
  }

  return deletePreviousWordFallback();
}

function getLiveMarkdownExtensions(): Extension[] {
  if (!liveMarkdownEngine) {
    return [];
  }

  return [
    createLiveMarkdownExtension(liveMarkdownEngine, {
      isEnabled: () => stateManager.getState().editor.liveMarkdown,
      isVimEnabled: () => stateManager.getState().editor.vimMode,
    }),
    createSemanticMarkdownVisibilityExtension({
      isEnabled: () => stateManager.getState().editor.liveMarkdown,
      isVimEnabled: () => stateManager.getState().editor.vimMode,
    }),
  ];
}

function resolveLiveMarkdownExtensions(): Extension[] {
  const state = stateManager.getState();
  const gate = resolveLiveMarkdownModeGate(
    isFeatureEnabled('useLiveMarkdown'),
    state.editor.liveMarkdown,
    state.editor.vimMode
  );

  return gate.attachExtensions ? getLiveMarkdownExtensions() : [];
}

function resolveMarkdownExtension(): Extension {
  if (!createMarkdownExtensionRef) {
    throw new Error('CM6 markdown extension factory unavailable');
  }

  const state = stateManager.getState();
  const gate = resolveFenceHighlightGate(
    isFeatureEnabled('useCM6'),
    isFeatureEnabled('useFenceHighlighting'),
    state.editor.liveMarkdown
  );

  return createMarkdownExtensionRef({
    enableFenceHighlighting: gate.attachFenceHighlighting,
    registry: gate.attachFenceHighlighting ? (cm6FenceLanguageRegistryRef ?? undefined) : undefined,
  });
}

async function ensureCm6MarkdownDependencies(): Promise<void> {
  if (createMarkdownExtensionRef && cm6FenceLanguageRegistryRef) {
    return;
  }

  const [markdownModule, registryModule] = await Promise.all([
    import('./editor/cm6/extensions/markdown'),
    import('./editor/cm6/extensions/fence-language-registry'),
  ]);

  createMarkdownExtensionRef = markdownModule.createMarkdownExtension;
  cm6FenceLanguageRegistryRef = registryModule.cm6FenceLanguageRegistry;
}

async function initializeEditor(elements: AppElements): Promise<void> {
  const state = stateManager.getState();

  if (!isFeatureEnabled('useCM6')) {
    const cm5Loaded = await ensureCM5Loaded();
    if (!cm5Loaded) {
      logger.error('CM5 fallback failed to load.');
      return;
    }

    const cm5Engine = new CM5EditorEngine();
    cm5Engine.initialize(elements.editor, state.editor.content);
    cm5Engine.on('change', (...args: unknown[]) => {
      const content = typeof args[0] === 'string' ? args[0] : '';
      stateManager.dispatch({ type: 'EDITOR_SET_CONTENT', payload: content });
    });

    editorEngine = cm5Engine;
    return;
  }

  await ensureCm6MarkdownDependencies();

  liveMarkdownEngine = new LiveMarkdownEngine();
  const extensions = [
    themeCompartment.of(getThemeExtension(resolveTheme(state.ui.theme))),
    markdownCompartment.of(resolveMarkdownExtension()),
    createKeymapExtensions(stateManager, {
      executeCommand: commandId => executeCommandById(commandId),
    }),
    vimCompartment.of(createVimExtensions(state.editor.vimMode)),
    liveMarkdownCompartment.of(resolveLiveMarkdownExtensions()),
  ];

  editorEngine = new CM6EditorEngine();
  editorEngine.initialize(elements.editor, state.editor.content, extensions);

  editorEngine.on('change', (...args: unknown[]) => {
    const content = typeof args[0] === 'string' ? args[0] : '';
    stateManager.dispatch({ type: 'EDITOR_SET_CONTENT', payload: content });
  });
}

function initializeScrollSync(elements: AppElements): void {
  if (!editorEngine) {
    return;
  }

  scrollCoordinator = new ScrollCoordinator(editorEngine, elements.preview, {
    isSyncAllowed: () => {
      if (!isFeatureEnabled('useNewScrollSync')) {
        return false;
      }

      const state = stateManager.getState();
      return !layoutManager.isMobile() && state.ui.layout === 'split';
    },
    getSourceMap: () => previewRendererRef?.getSourceMap() ?? null,
  });

  scrollCoordinator.attach();
}

function initializeModalComponents(elements: AppElements): void {
  const shareModal = new Modal(elements.shareModal, {
    initialFocusSelector: '#share-type',
  });

  const fontModal = new Modal(elements.fontModal, {
    initialFocusSelector: '#font-body',
  });

  const shortcutsModal = new Modal(elements.shortcutsModal);

  modalRegistry.set('share', shareModal);
  modalRegistry.set('fonts', fontModal);
  modalRegistry.set('shortcuts', shortcutsModal);

  shareModal.onClose(() => {
    if (stateManager.getState().ui.activeModal === 'share') {
      stateManager.dispatch({ type: 'UI_SET_MODAL', payload: null });
    }
  });

  fontModal.onClose(() => {
    if (stateManager.getState().ui.activeModal === 'fonts') {
      stateManager.dispatch({ type: 'UI_SET_MODAL', payload: null });
    }
  });

  shortcutsModal.onClose(() => {
    if (stateManager.getState().ui.activeModal === 'shortcuts') {
      stateManager.dispatch({ type: 'UI_SET_MODAL', payload: null });
    }
  });

  elements.shareClose.addEventListener('click', () => shareModal.close());
  elements.fontClose.addEventListener('click', () => fontModal.close());
  elements.shortcutsClose.addEventListener('click', () => shortcutsModal.close());
}

function openModal(name: 'share' | 'fonts' | 'shortcuts'): void {
  if (name === 'share') {
    hydrateShareModalState();
  }

  closeAllModals();
  stateManager.dispatch({ type: 'UI_SET_MODAL', payload: name });
  modalRegistry.get(name)?.open();
}

function closeAllModals(): void {
  for (const modal of modalRegistry.values()) {
    modal.close();
  }

  if (stateManager.getState().ui.activeModal !== null) {
    stateManager.dispatch({ type: 'UI_SET_MODAL', payload: null });
  }
}

async function createShareLink(elements: AppElements): Promise<void> {
  elements.shareCreate.disabled = true;
  elements.shareError.textContent = '';

  const state = stateManager.getState();
  const payload: SharePayload = {
    title: state.editor.title,
    content: state.editor.content,
    type: elements.shareType.value === 'live' ? 'live' : 'static',
    privacy: elements.sharePrivacy.value === 'public' ? 'public' : 'secret',
  };

  const result = await shareClient.create(payload);
  if (result.success && result.url) {
    elements.shareUrl.value = result.url;
    elements.shareCopy.disabled = false;
    const session = shareClient.getLiveSession();
    elements.shareUpdate.disabled = !(payload.type === 'live' && session);
    elements.shareError.textContent = '';

    stateManager.dispatch({
      type: 'SHARE_SET_STATE',
      payload: {
        id: result.id ?? null,
        url: result.url,
        type: payload.type,
        privacy: payload.privacy,
      },
    });
  } else {
    elements.shareError.textContent = result.error ?? 'Share service unavailable.';
    elements.shareCopy.disabled = true;
    elements.shareUpdate.disabled = true;
  }

  elements.shareCreate.disabled = false;
}

async function updateLiveShare(elements: AppElements): Promise<void> {
  const session = shareClient.getLiveSession();
  if (!session) {
    elements.shareError.textContent = 'Live share update failed.';
    return;
  }

  const state = stateManager.getState();
  const result = await shareClient.update(session.id, session.editToken, {
    title: state.editor.title,
    content: state.editor.content,
    type: 'live',
    privacy: elements.sharePrivacy.value === 'public' ? 'public' : 'secret',
  });

  if (result.success && result.url) {
    elements.shareUrl.value = result.url;
    elements.shareError.textContent = '';

    stateManager.dispatch({
      type: 'SHARE_SET_STATE',
      payload: {
        id: session.id,
        url: result.url,
        type: 'live',
        privacy: elements.sharePrivacy.value === 'public' ? 'public' : 'secret',
      },
    });

    return;
  }

  elements.shareError.textContent = result.error ?? 'Live share update failed.';
}

function initializeUI(elements: AppElements): void {
  initializeModalComponents(elements);

  menu = new Menu(elements.actionMenu, elements.menuButton);

  const menuItems = elements.actionMenu.querySelectorAll<HTMLButtonElement>('button.menu-item');
  for (const menuItem of menuItems) {
    menuItem.addEventListener('click', () => {
      const command = getMenuCommand(menuItem.id);
      if (!command) {
        return;
      }

      executeCommandById(command.id);
      menu?.close();
    });
  }

  elements.shareCreate.addEventListener('click', () => {
    void createShareLink(elements);
  });

  elements.shareUpdate.addEventListener('click', () => {
    void updateLiveShare(elements);
  });

  elements.shareCopy.addEventListener('click', async () => {
    if (!elements.shareUrl.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(elements.shareUrl.value);
    } catch {
      elements.shareUrl.select();
      document.execCommand('copy');
    }
  });

  elements.docTitle.addEventListener('input', () => {
    stateManager.dispatch({
      type: 'EDITOR_SET_TITLE',
      payload: elements.docTitle.value || 'Untitled',
    });
  });

  globalKeybindingsCleanup = setupGlobalKeybindings(stateManager, {
    editorHasFocus: () => editorEngine?.hasFocus() ?? false,
    executeCommand: commandId => executeCommandById(commandId),
  });
}

function initializePreview(elements: AppElements): void {
  previewRendererRef = createPreviewRenderer(elements.preview, renderMarkdownWithSourceMap);

  const renderFromState = (): void => {
    previewRendererRef?.render(stateManager.getState().editor.content);
  };

  renderFromState();

  stateManager.subscribe((newState, prevState) => {
    if (newState.editor.content !== prevState.editor.content) {
      previewRendererRef?.render(newState.editor.content);
    }

    if (newState.ui.theme !== prevState.ui.theme) {
      themeManager.apply(newState.ui.theme);

      const view = editorEngine instanceof CM6EditorEngine ? editorEngine.getView() : null;
      if (view) {
        view.dispatch({
          effects: themeCompartment.reconfigure(getThemeExtension(resolveTheme(newState.ui.theme))),
        });
      }
    }

    if (newState.editor.vimMode !== prevState.editor.vimMode) {
      const view = editorEngine instanceof CM6EditorEngine ? editorEngine.getView() : null;
      if (view) {
        view.dispatch({
          effects: vimCompartment.reconfigure(createVimExtensions(newState.editor.vimMode)),
        });
      }
    }

    if (
      liveMarkdownEngine &&
      (newState.editor.liveMarkdown !== prevState.editor.liveMarkdown ||
        newState.editor.vimMode !== prevState.editor.vimMode)
    ) {
      const view = editorEngine instanceof CM6EditorEngine ? editorEngine.getView() : null;
      if (view) {
        view.dispatch({
          effects: liveMarkdownCompartment.reconfigure(resolveLiveMarkdownExtensions()),
        });
      }
    }

    if (newState.editor.liveMarkdown !== prevState.editor.liveMarkdown) {
      const view = editorEngine instanceof CM6EditorEngine ? editorEngine.getView() : null;
      if (view) {
        view.dispatch({
          effects: markdownCompartment.reconfigure(resolveMarkdownExtension()),
        });
      }
    }

    if (newState.ui.layout !== prevState.ui.layout) {
      layoutManager.setMode(newState.ui.layout);
    }

    if (newState.ui.splitRatio !== prevState.ui.splitRatio) {
      layoutManager.setSplitRatio(newState.ui.splitRatio);
    }

    if (newState.ui.activeModal !== prevState.ui.activeModal) {
      if (newState.ui.activeModal === null) {
        closeAllModals();
      } else {
        modalRegistry.get(newState.ui.activeModal)?.open();
      }
    }

    syncMenuLabels();
  });
}

async function initializeApplication(): Promise<void> {
  const elements = getAppElements();
  if (!elements) {
    return;
  }

  appElementsRef = elements;

  const state = stateManager.getState();
  elements.docTitle.value = state.editor.title;

  themeManager.apply(state.ui.theme);
  typographySystem.initialize();

  await initializeEditor(elements);
  initializeScrollSync(elements);
  initializeUI(elements);
  initializePreview(elements);
  syncMenuLabels();

  logger.info('Typim initialization complete');
}

function initializeDevDiagnostics(): void {
  if (CONFIG.environment !== 'development') {
    return;
  }

  const diagnostics: TypimDiagnostics = {
    config: CONFIG,
    state: stateManager,
    events: eventBus,
    storage,
    layout: layoutManager,
    theme: themeManager,
    get ready(): boolean {
      return diagnosticsReady;
    },
    get initStatus(): 'initializing' | 'ready' {
      return diagnosticsReady ? 'ready' : 'initializing';
    },
    get editor(): CM6EditorEngine | CM5EditorEngine {
      if (!diagnosticsReady || !editorEngine) {
        throw new Error('Typim diagnostics are not ready. Await window.typim.whenReady() first.');
      }

      return editorEngine;
    },
    whenReady(): Promise<TypimDiagnostics> {
      return diagnosticsReadyPromise.then(() => diagnostics);
    },
    get scroll(): ScrollCoordinator | null {
      return scrollCoordinator;
    },
  };

  (window as TypimWindow).typim = diagnostics;
}

initializeDevDiagnostics();

document.addEventListener('DOMContentLoaded', () => {
  void initializeApplication()
    .then(() => {
      diagnosticsReady = true;
      resolveDiagnosticsReady?.();
    })
    .catch(error => {
      rejectDiagnosticsReady?.(error);
      logger.error('Typim initialization failed', error);
    });
});

window.addEventListener('beforeunload', () => {
  globalKeybindingsCleanup?.();
  menu?.destroy();
  scrollCoordinator?.destroy();
  editorEngine?.destroy();
  typographySystem.destroy();
  themeManager.destroy();
  layoutManager.destroy();
});
