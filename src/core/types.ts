/**
 * Global type definitions for Typim
 * @module core/types
 */

// ============================================
// Editor Types
// ============================================

/** Cursor position in the editor */
export interface CursorPosition {
  line: number;
  ch: number;
}

/** Editor scroll information */
export interface ScrollInfo {
  top: number;
  height: number;
  clientHeight: number;
}

/** Supported editor events */
export type EditorEvent = 'change' | 'scroll' | 'focus' | 'blur' | 'cursorActivity';

/** Editor engine interface contract */
export interface IEditorEngine {
  getValue(): string;
  setValue(value: string): void;
  getCursor(): CursorPosition;
  setCursor(pos: CursorPosition): void;
  getScrollInfo(): ScrollInfo;
  scrollTo(top: number): void;
  focus(): void;
  hasFocus(): boolean;
  on(event: EditorEvent, handler: (...args: unknown[]) => void): () => void;
  off(event: EditorEvent, handler: (...args: unknown[]) => void): void;
  destroy(): void;
}

// ============================================
// State Types
// ============================================

/** Application layout modes */
export type LayoutMode = 'split' | 'single' | 'focus' | 'mobile';

/** UI themes */
export type Theme = 'light' | 'dark' | 'system';

/** Theme application result */
export interface ThemeApplyResult {
  applied: boolean;
  effectiveTheme: 'light' | 'dark';
}

/** Theme manager interface */
export interface IThemeManager {
  apply(theme: Theme): ThemeApplyResult;
  getTheme(): Theme;
}

/** Font options */
export type BodyFont = 'serif' | 'sans';
export type MonoFont = 'plex' | 'system';

/** Share types */
export type ShareType = 'static' | 'live';
export type SharePrivacy = 'secret' | 'public';

/** Share state (without edit token - INV-002) */
export interface ShareState {
  id: string | null;
  url: string;
  type: ShareType;
  privacy: SharePrivacy;
}

/** Editor state */
export interface EditorState {
  content: string;
  title: string;
  vimMode: boolean;
  liveMarkdown: boolean;
}

/** UI state */
export interface UIState {
  theme: Theme;
  layout: LayoutMode;
  mobilePane: 'editor' | 'preview';
  splitRatio: number;
  menuOpen: boolean;
  activeModal: string | null;
}

/** Font state */
export interface FontState {
  body: BodyFont;
  mono: MonoFont;
}

/** Complete application state */
export interface AppState {
  editor: EditorState;
  ui: UIState;
  fonts: FontState;
  share: ShareState;
}

/** State action types */
export type StateAction =
  | { type: 'EDITOR_SET_CONTENT'; payload: string }
  | { type: 'EDITOR_SET_TITLE'; payload: string }
  | { type: 'EDITOR_TOGGLE_VIM'; payload?: boolean }
  | { type: 'EDITOR_TOGGLE_LIVE_MD'; payload?: boolean }
  | { type: 'UI_SET_THEME'; payload: Theme }
  | { type: 'UI_SET_LAYOUT'; payload: LayoutMode }
  | { type: 'UI_SET_MOBILE_PANE'; payload: 'editor' | 'preview' }
  | { type: 'UI_SET_SPLIT_RATIO'; payload: number }
  | { type: 'UI_TOGGLE_MENU'; payload?: boolean }
  | { type: 'UI_SET_MODAL'; payload: string | null }
  | { type: 'FONTS_SET_BODY'; payload: BodyFont }
  | { type: 'FONTS_SET_MONO'; payload: MonoFont }
  | { type: 'SHARE_SET_STATE'; payload: ShareState }
  | { type: 'RESET_STATE' };

// ============================================
// Event Bus Types
// ============================================

/** Event payload type */
export type EventPayload = unknown;

export interface EventEnvelope {
  event: AppEvent;
  payload?: EventPayload;
  source: string;
  timestamp: number;
}

/** Event handler type */
export type EventHandler = (envelope: EventEnvelope) => void;

export interface EventEmitResult {
  delivered: number;
  envelope: EventEnvelope;
}

export interface DispatchError {
  code: 'INVALID_ACTION' | 'INVALID_PAYLOAD';
  message: string;
}

export interface DispatchResult {
  ok: boolean;
  state: AppState;
  prevState: AppState;
  changed: boolean;
  error?: DispatchError;
}

export type DispatchResultCompat = DispatchResult & AppState;

/** Typed event names */
export type AppEvent =
  | 'state:changed'
  | 'editor:change'
  | 'editor:scroll'
  | 'editor:focus'
  | 'theme:changed'
  | 'layout:changed'
  | 'modal:opened'
  | 'modal:closed'
  | 'share:created'
  | 'share:updated'
  | 'fonts:changed'
  | 'livemd:toggled';

// ============================================
// Live Markdown Types
// ============================================

/** Input triggers for live markdown */
export type InputTrigger = 'space' | 'enter' | 'backspace' | 'paste';

/** Block context for live markdown */
export interface BlockContext {
  inCodeFence: boolean;
  listDepth: number;
  inQuote: boolean;
  previousLineText?: string;
  vimMode?: boolean;
  lineNumber?: number;
  column?: number;
}

/** Transform rule result */
export interface TransformResult {
  transformed: boolean;
  replacement?: string;
  newCursor?: CursorPosition;
  exitRules?: ExitRule[];
}

/** Exit rule definition */
export interface ExitRule {
  condition: 'double-enter' | 'empty-line' | 'backspace-at-start';
  action: 'exit-block' | 'deindent' | 'remove-bullet';
}

/** Live markdown engine interface */
export interface ILiveMarkdownEngine {
  processInput(
    line: string,
    cursor: CursorPosition,
    trigger: InputTrigger,
    context: BlockContext
  ): TransformResult;
}

// ============================================
// Scroll Sync Types
// ============================================

/** Scroll source */
export type ScrollSource = 'editor' | 'preview';

/** Scroll sync input */
export interface ScrollSyncInput {
  source: ScrollSource;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  sourceViewport?: number;
  sourceMap?: PreviewSourceMap | null;
}

/** Scroll sync output */
export interface ScrollSyncOutput {
  synced: boolean;
  targetScrollTop: number;
  mode?: 'source-map' | 'ratio-fallback';
  fallbackReason?: 'missing-map' | 'stale-map' | 'no-anchor-match';
}

/** Preview anchor emitted from markdown source maps */
export interface PreviewSourceAnchor {
  lineStart: number;
  lineEnd: number;
  elementId: string;
  offsetTop: number;
  offsetHeight?: number;
}

/** Preview source map used for split sync resolution */
export interface PreviewSourceMap {
  anchors: PreviewSourceAnchor[];
  mapVersion: number;
  totalLines: number;
}

/** Scroll coordinator interface */
export interface IScrollCoordinator {
  sync(input: ScrollSyncInput): ScrollSyncOutput;
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
}

// ============================================
// Share Types
// ============================================

/** Share payload for API */
export interface SharePayload {
  content: string;
  title: string;
  type: ShareType;
  privacy: SharePrivacy;
}

/** Share API response */
export interface ShareResponse {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

/** Share client interface */
export interface IShareClient {
  create(payload: SharePayload): Promise<ShareResponse>;
  update(id: string, editToken: string, payload: SharePayload): Promise<ShareResponse>;
}

// ============================================
// Typography Types
// ============================================

/** Font token */
export interface FontToken {
  family: string;
  fallback: string;
  display: 'swap' | 'block' | 'fallback' | 'optional';
}

/** Size scale */
export type SizeScale = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';

/** Typography system interface */
export interface ITypographySystem {
  loadFont(token: FontToken): Promise<boolean>;
  applyFont(element: HTMLElement, font: FontToken): void;
  setBodyFont(font: FontToken): void;
  setMonoFont(font: FontToken): void;
}

// ============================================
// Layout Types
// ============================================

/** Layout manager interface */
export interface ILayoutManager {
  setMode(mode: LayoutMode): boolean;
  getMode(): LayoutMode;
  setSplitRatio(ratio: number): void;
  getSplitRatio(): number;
  isMobile(): boolean;
}

// ============================================
// Storage Types
// ============================================

/** Storage operation result */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Storage adapter interface */
export interface IStorageAdapter {
  get(key: string, version: number): StorageResult<unknown>;
  set(key: string, value: unknown, version: number): StorageResult<void>;
  remove(key: string): void;
}

// ============================================
// Configuration Types
// ============================================

/** Feature flags */
export interface FeatureFlags {
  useCM6: boolean;
  useLiveMarkdown: boolean;
  useFenceHighlighting: boolean;
  useNewScrollSync: boolean;
  useTokenizedStyles: boolean;
}

/** Environment type */
export type Environment = 'development' | 'production';

/** Application configuration */
export interface AppConfig {
  environment: Environment;
  version: string;
  storageVersion: number;
  features: FeatureFlags;
  api: {
    baseUrl: string;
    timeout: number;
  };
}
