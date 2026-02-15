// ============================================================
// DOM References
// ============================================================
const editorRoot = document.getElementById("editor");
const preview = document.getElementById("preview");
const fileInput = document.getElementById("file-input");
const docTitle = document.getElementById("doc-title");
const statusLeft = document.getElementById("status-left");
const statusRight = document.getElementById("status-right");
const focusBtn = document.getElementById("focus-btn");

// Menu elements
const menuBtn = document.getElementById("menu-btn");
const actionMenu = document.getElementById("action-menu");
const menuOpen = document.getElementById("menu-open");
const menuSave = document.getElementById("menu-save");
const menuSplit = document.getElementById("menu-split");
const menuVim = document.getElementById("menu-vim");
const menuTheme = document.getElementById("menu-theme");
const menuFonts = document.getElementById("menu-fonts");
const menuShortcuts = document.getElementById("menu-shortcuts");
const menuShare = document.getElementById("menu-share");
const menuLiveMd = document.getElementById("menu-livemd");

// Split resizer element
const splitResizer = document.getElementById("split-resizer");

// Modal elements
const shareModal = document.getElementById("share-modal");
const shareClose = document.getElementById("share-close");
const shareTypeSelect = document.getElementById("share-type");
const sharePrivacySelect = document.getElementById("share-privacy");
const shareCreateBtn = document.getElementById("share-create");
const shareUpdateBtn = document.getElementById("share-update");
const shareUrlInput = document.getElementById("share-url");
const shareCopyBtn = document.getElementById("share-copy");
const shareError = document.getElementById("share-error");
const fontModal = document.getElementById("font-modal");
const fontClose = document.getElementById("font-close");
const fontBodySelect = document.getElementById("font-body");
const fontMonoSelect = document.getElementById("font-mono");
const shortcutsModal = document.getElementById("shortcuts-modal");
const shortcutsClose = document.getElementById("shortcuts-close");

// ============================================================
// State
// ============================================================
let vimEnabled = false;
let renderScheduled = false;
let lastValue = null;
let liveSyncTimer = null;
let currentTheme = "light";
let enableLiveMarkdown = false;
let lmInCodeFence = false;

// Live mode state preservation (STEP-001)
let preLiveSplitState = null; // 'split' or 'single' - remembers state before live mode

// Split resizer constants
const SPLIT_RATIO_KEY = "splitRatio";
const SPLIT_RATIO_DEFAULT = 0.5;
const SPLIT_RATIO_MIN = 0.3;
const SPLIT_RATIO_MAX = 0.7;
const SPLIT_KEYBOARD_STEP = 0.02;
const SPLIT_KEYBOARD_STEP_LARGE = 0.05;
const LIVE_MD_KEY = "enableLiveMarkdown";

// Split resizer runtime state
let splitRatio = SPLIT_RATIO_DEFAULT;
let isResizing = false;
let activePointerId = null;
// STEP-002: Separate collections for style marks and symbol-hiding marks
let liveMarkdownStyleMarks = [];
let liveMarkdownSymbolMarks = [];
let liveMarkdownBulletMarks = [];

const shareState = {
  id: null,
  url: "",
  type: "static",
  privacy: "secret",
  editToken: "",
};

const fontOptions = {
  body: {
    serif: '"Source Serif 4", "Iowan Old Style", "Georgia", serif',
    sans: '"Source Sans 3", "Noto Sans", "Helvetica Neue", sans-serif',
  },
  mono: {
    plex: '"Source Code Pro", "IBM Plex Mono", "Menlo", "Consolas", monospace',
    system: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
};

// ============================================================
// Markdown Configuration
// ============================================================
const md = window.markdownit({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

md.set({
  highlight: (str, lang) => {
    if (lang && window.hljs && window.hljs.getLanguage(lang)) {
      try {
        const highlighted = window.hljs.highlight(str, { language: lang }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      } catch (_) {
        return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
      }
    }
    return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// ============================================================
// Editor Setup
// ============================================================
const starter = `# Typim\n\nWelcome to a focused markdown space.\n\n## Quick start\n- Write markdown on the left\n- Preview updates instantly on the right\n- Save with Ctrl+S or Cmd+S\n\n> Tip: Use **bold**, _italic_, and inline code with single backticks.\n\n### Task list\n- [x] Clean layout\n- [ ] Your next idea\n\n### Dev joke\nWhy do programmers prefer dark mode?\n\nBecause light attracts bugs! 🐛\n\n\`\`\`js\nfunction hello() {\n  return "Hello";\n}\n\`\`\`\n`;

const editor = window.CodeMirror(editorRoot, {
  value: starter,
  mode: "markdown",
  theme: "xq-light",
  lineWrapping: true,
  lineNumbers: false,
  keyMap: "default",
  extraKeys: {
    "Ctrl-W": "delWordBefore",
  },
});

// ============================================================
// Ctrl+W Global Capture (prevent tab close when editor focused)
// ============================================================
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const isAnyModalOpen = () => {
  return (
    (shareModal && shareModal.classList.contains("show")) ||
    (fontModal && fontModal.classList.contains("show")) ||
    (shortcutsModal && shortcutsModal.classList.contains("show")) ||
    document.querySelector(".modal.show") !== null
  );
};

// STEP-004: Focus guard using editor.hasFocus() plus wrapper containment
const isEditorFocused = () => {
  // Primary check: CodeMirror's own focus state
  if (editor.hasFocus()) return true;

  // Fallback: check if active element is within editor wrapper
  const active = document.activeElement;
  if (!active) return false;
  const cmWrapper = editor.getWrapperElement();
  return cmWrapper.contains(active);
};

document.addEventListener(
  "keydown",
  (e) => {
    // Only intercept Ctrl+W on non-Mac platforms
    if (isMac) return;
    if (e.key.toLowerCase() !== "w" || !e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    // Skip if Vim mode is active (Vim has its own Ctrl-W window commands)
    if (vimEnabled) return;

    // Skip if any modal is open
    if (isAnyModalOpen()) return;

    // Only intercept when editor has focus
    if (!isEditorFocused()) return;

    // Prevent browser tab close and stop propagation
    e.preventDefault();
    e.stopPropagation();

    // Execute the delete-word-before command via CodeMirror
    editor.execCommand("delWordBefore");
  },
  true, // capture phase
);

// ============================================================
// Helpers
// ============================================================
const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

const syncVimButton = () => {
  menuVim.textContent = vimEnabled ? "Vim: On" : "Vim: Off";
};

const syncLiveMdButton = () => {
  menuLiveMd.textContent = enableLiveMarkdown ? "Live MD: On" : "Live MD: Off";
};

// ============================================================
// Preferences: Theme
// ============================================================
const getInitialTheme = () => {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const applyTheme = (theme) => {
  currentTheme = theme;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (theme === "dark") {
    document.body.setAttribute("data-theme", "dark");
    menuTheme.textContent = "Theme: Dark";
    editor.setOption("theme", "xq-dark");
    if (themeMeta) themeMeta.setAttribute("content", "#1f1f1f");
  } else {
    document.body.removeAttribute("data-theme");
    menuTheme.textContent = "Theme: Light";
    editor.setOption("theme", "xq-light");
    if (themeMeta) themeMeta.setAttribute("content", "#f2f2f2");
  }
  localStorage.setItem("theme", theme);
};

const toggleTheme = () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
};

// ============================================================
// Preferences: Fonts
// ============================================================
const applyFonts = (bodyKey, monoKey) => {
  const bodyFont = fontOptions.body[bodyKey] || fontOptions.body.serif;
  const monoFont = fontOptions.mono[monoKey] || fontOptions.mono.plex;
  document.documentElement.style.setProperty("--font-body", bodyFont);
  document.documentElement.style.setProperty("--font-mono", monoFont);
  localStorage.setItem("fontBody", bodyKey);
  localStorage.setItem("fontMono", monoKey);
  editor.refresh();
};

const initFonts = () => {
  const bodyKey = localStorage.getItem("fontBody") || "serif";
  const monoKey = localStorage.getItem("fontMono") || "plex";
  fontBodySelect.value = bodyKey;
  fontMonoSelect.value = monoKey;
  applyFonts(bodyKey, monoKey);
};

// ============================================================
// Split Resizer Helpers
// ============================================================
const clampRatio = (value) => Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, value));

const readStoredSplitRatio = () => {
  const stored = localStorage.getItem(SPLIT_RATIO_KEY);
  if (stored !== null) {
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && parsed >= SPLIT_RATIO_MIN && parsed <= SPLIT_RATIO_MAX) {
      splitRatio = parsed;
      return;
    }
  }
  splitRatio = SPLIT_RATIO_DEFAULT;
};

const applySplitRatio = (value, { persist = true } = {}) => {
  splitRatio = clampRatio(value);
  document.querySelector(".workspace").style.setProperty("--split-ratio", String(splitRatio));
  syncResizerA11y();
  if (persist) {
    localStorage.setItem(SPLIT_RATIO_KEY, String(splitRatio));
  }
};

const isSplitResizable = () => {
  return (
    !isMobile() &&
    !document.body.classList.contains("split-off") &&
    !document.body.classList.contains("focus")
  );
};

const syncResizerA11y = () => {
  const percent = Math.round(splitRatio * 100);
  splitResizer.setAttribute("aria-valuenow", String(percent));
};

const updateResizerVisibility = () => {
  if (isSplitResizable()) {
    splitResizer.removeAttribute("hidden");
    splitResizer.setAttribute("tabindex", "0");
  } else {
    splitResizer.setAttribute("hidden", "");
    splitResizer.setAttribute("tabindex", "-1");
  }
};

// STEP-005: Compute mode-specific width tokens
const computeWidthTokens = () => {
  if (isMobile()) {
    return { maxWidthPx: "100%", paddingInlinePx: "20px" };
  }

  // Focus mode: 1400px max width
  if (document.body.classList.contains("focus")) {
    return { maxWidthPx: "1400px", paddingInlinePx: "56px" };
  }

  // Single mode (including live-md): 1320px max width
  if (document.body.classList.contains("split-off")) {
    return { maxWidthPx: "1320px", paddingInlinePx: "56px" };
  }

  // Split mode: 1100px max width per pane
  return { maxWidthPx: "1100px", paddingInlinePx: "40px" };
};

// STEP-005: Apply width tokens to CSS variables
const applyWidthTokens = () => {
  const tokens = computeWidthTokens();
  document.documentElement.style.setProperty("--container-width", tokens.maxWidthPx);
  document.documentElement.style.setProperty("--pane-inline-padding", tokens.paddingInlinePx);

  // Also set explicit content max tokens for reference
  document.documentElement.style.setProperty("--content-max-single", "1320px");
  document.documentElement.style.setProperty("--content-max-split", "1100px");
  document.documentElement.style.setProperty("--content-max-focus", "1400px");
};

const handleResizerPointerDown = (event) => {
  if (!isSplitResizable()) return;
  isResizing = true;
  activePointerId = event.pointerId;
  splitResizer.setPointerCapture(activePointerId);
  document.body.classList.add("resizing");
  event.preventDefault();
};

const handleResizerPointerMove = (event) => {
  if (!isResizing || event.pointerId !== activePointerId) return;
  const workspace = document.querySelector(".workspace");
  const rect = workspace.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  applySplitRatio(ratio, { persist: false });
};

const stopResizing = (event) => {
  if (!isResizing) return;
  if (event && event.pointerId !== undefined && event.pointerId !== activePointerId) return;
  isResizing = false;
  if (activePointerId !== null && splitResizer.hasPointerCapture(activePointerId)) {
    splitResizer.releasePointerCapture(activePointerId);
  }
  activePointerId = null;
  document.body.classList.remove("resizing");
  localStorage.setItem(SPLIT_RATIO_KEY, String(splitRatio));
};

const handleResizerKeydown = (event) => {
  if (!isSplitResizable()) return;
  let nextRatio = splitRatio;
  const step = event.shiftKey ? SPLIT_KEYBOARD_STEP_LARGE : SPLIT_KEYBOARD_STEP;

  switch (event.key) {
    case "ArrowLeft":
      nextRatio -= step;
      break;
    case "ArrowRight":
      nextRatio += step;
      break;
    case "Home":
      nextRatio = SPLIT_RATIO_MIN;
      break;
    case "End":
      nextRatio = SPLIT_RATIO_MAX;
      break;
    default:
      return;
  }

  event.preventDefault();
  applySplitRatio(nextRatio);
};

// STEP-002: Clear style, symbol, and bullet marks
const clearLiveMarkdownMarks = () => {
  liveMarkdownStyleMarks.forEach((mark) => mark.clear());
  liveMarkdownStyleMarks = [];
  liveMarkdownSymbolMarks.forEach((mark) => mark.clear());
  liveMarkdownSymbolMarks = [];
  liveMarkdownBulletMarks.forEach((mark) => mark.clear());
  liveMarkdownBulletMarks = [];
};

// STEP-002: Returns { className, symbolMasks } where symbolMasks is array of { from, to }
const classifyLine = (lineText) => {
  const result = { className: null, symbolMasks: [] };

  // Heading: hide '# ' prefix
  const headingMatch = lineText.match(/^(#{1,6})(\s+)(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    result.className = `cm-lm-h${Math.min(6, level)}`;
    result.symbolMasks.push({ from: 0, to: headingMatch[1].length + headingMatch[2].length });
    return result;
  }

  // Unordered list: replace '- ', '* ', '+ ' with bullet widget
  const ulMatch = lineText.match(/^(\s*)([-*+])(\s+)(.*)$/);
  if (ulMatch && ulMatch[2]) {
    result.className = "cm-lm-ul";
    // Replace marker char with bullet glyph, collapse trailing space
    result.bulletReplace = {
      from: ulMatch[1].length,
      markerEnd: ulMatch[1].length + 1,
      to: ulMatch[1].length + 1 + ulMatch[3].length,
    };
    return result;
  }

  // Ordered list: hide '1. ', '2. ' etc prefix
  const olMatch = lineText.match(/^(\s*)(\d+\.)(\s+)(.*)$/);
  if (olMatch && olMatch[2]) {
    result.className = "cm-lm-ol";
    result.symbolMasks.push({ from: olMatch[1].length, to: olMatch[1].length + olMatch[2].length + olMatch[3].length });
    return result;
  }

  // Blockquote: hide '> ' prefix
  const bqMatch = lineText.match(/^(\u003e)(\s+)(.*)$/);
  if (bqMatch) {
    result.className = "cm-lm-blockquote";
    result.symbolMasks.push({ from: 0, to: 1 + bqMatch[2].length });
    return result;
  }

  // Horizontal rule
  if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(lineText)) {
    result.className = "cm-lm-hr";
    return result;
  }

  // Code fence
  if (/^```/.test(lineText) || lmInCodeFence) {
    result.className = "cm-lm-code-fence";
    // Hide fence ticks
    if (/^```/.test(lineText)) {
      result.symbolMasks.push({ from: 0, to: lineText.match(/^```[a-zA-Z0-9]*/)[0].length });
    }
    return result;
  }

  return result;
};

// STEP-002: Replace live markdown styling with syntax masking
const refreshLiveMarkdownPresentation = () => {
  clearLiveMarkdownMarks();
  if (!enableLiveMarkdown) return;

  const lineCount = editor.lineCount();
  lmInCodeFence = false;

  for (let i = 0; i < lineCount; i += 1) {
    const text = editor.getLine(i);

    // Track code fence state
    if (/^```/.test(text)) {
      lmInCodeFence = !lmInCodeFence;
    }

    const { className, symbolMasks, bulletReplace } = classifyLine(text);

    // Apply typography class to entire line
    if (className) {
      liveMarkdownStyleMarks.push(
        editor.markText({ line: i, ch: 0 }, { line: i, ch: text.length }, { className }),
      );
    }

    // Collapse symbol marks so they take no visual space
    if (symbolMasks && symbolMasks.length > 0) {
      for (const mask of symbolMasks) {
        liveMarkdownSymbolMarks.push(
          editor.markText(
            { line: i, ch: mask.from },
            { line: i, ch: mask.to },
            { collapsed: true, clearOnEnter: true },
          ),
        );
      }
    }

    // Replace bullet marker with glyph widget
    if (bulletReplace) {
      const br = bulletReplace;
      const bulletSpan = document.createElement("span");
      bulletSpan.className = "cm-lm-bullet";
      bulletSpan.textContent = "•";
      liveMarkdownBulletMarks.push(
        editor.markText(
          { line: i, ch: br.from },
          { line: i, ch: br.markerEnd },
          { replacedWith: bulletSpan, clearOnEnter: true },
        ),
      );
      // Collapse trailing space after bullet
      if (br.markerEnd < br.to) {
        liveMarkdownSymbolMarks.push(
          editor.markText(
            { line: i, ch: br.markerEnd },
            { line: i, ch: br.to },
            { collapsed: true, clearOnEnter: true },
          ),
        );
      }
    }
  }
};

const maybeTransformLiveMarkdown = (_instance, changeObj) => {
  if (!enableLiveMarkdown || vimEnabled) return;
  if (!changeObj || changeObj.origin !== "+input") return;
  const inserted = (changeObj.text || []).join("\n");
  if (inserted !== " ") return;

  const cursor = editor.getCursor();
  const line = cursor.line;
  const lineText = editor.getLine(line);

  const transforms = [
    [/^#\s\s+/, "# "],
    [/^##\s\s+/, "## "],
    [/^###\s\s+/, "### "],
    [/^####\s\s+/, "#### "],
    [/^#####\s\s+/, "##### "],
    [/^######\s\s+/, "###### "],
    [/^>\s\s+/, "> "],
    [/^-\s\s+/, "- "],
    [/^\*\s\s+/, "* "],
    [/^\d+\.\s\s+/, (match) => match.replace(/\s\s+$/, " ")],
  ];

  for (const [pattern, replacement] of transforms) {
    if (pattern.test(lineText)) {
      const replaced = typeof replacement === "function" ? lineText.replace(pattern, replacement) : lineText.replace(pattern, replacement);
      editor.replaceRange(replaced, { line, ch: 0 }, { line, ch: lineText.length }, "+livemd");
      editor.setCursor({ line, ch: replaced.length });
      break;
    }
  }
};

// STEP-001: Live mode state controller with single-pane enforcement
const setLiveModeState = (enabled) => {
  enableLiveMarkdown = enabled;

  if (enabled) {
    // Remember current split state before forcing single pane
    const wasSplitOff = document.body.classList.contains("split-off");
    preLiveSplitState = wasSplitOff ? "single" : "split";

    // Force single pane on desktop
    if (!isMobile()) {
      document.body.classList.add("split-off");
    }

    // Add live-md body class for styling
    document.body.classList.add("live-md");
  } else {
    // Remove live-md body class
    document.body.classList.remove("live-md");

    // Restore previous split state on desktop
    if (!isMobile() && preLiveSplitState) {
      if (preLiveSplitState === "split") {
        document.body.classList.remove("split-off");
      } else {
        document.body.classList.add("split-off");
      }
    }
    preLiveSplitState = null;
  }

  localStorage.setItem(LIVE_MD_KEY, enableLiveMarkdown ? "on" : "off");
  syncLiveMdButton();
  updateSplitButton();
  updateResizerVisibility();
  applyWidthTokens();
  editor.refresh();
  refreshLiveMarkdownPresentation();
};

const toggleLiveMarkdown = () => {
  setLiveModeState(!enableLiveMarkdown);
  editor.focus();
};

const initLayout = () => {
  readStoredSplitRatio();
  applySplitRatio(splitRatio, { persist: false });
  applyWidthTokens();
  updateResizerVisibility();

  splitResizer.addEventListener("pointerdown", handleResizerPointerDown);
  splitResizer.addEventListener("pointermove", handleResizerPointerMove);
  splitResizer.addEventListener("pointerup", stopResizing);
  splitResizer.addEventListener("pointercancel", stopResizing);
  splitResizer.addEventListener("keydown", handleResizerKeydown);

  const storedLiveMd = localStorage.getItem(LIVE_MD_KEY);
  const shouldEnableLiveMd = storedLiveMd === "on";
  if (shouldEnableLiveMd) {
    setLiveModeState(true);
  } else {
    syncLiveMdButton();
  }
  editor.on("changes", refreshLiveMarkdownPresentation);
  editor.on("inputRead", maybeTransformLiveMarkdown);
};

// ============================================================
// Editor & Preview Sync
// ============================================================
const render = () => {
  const raw = editor.getValue();
  if (raw === lastValue) return;
  lastValue = raw;
  preview.innerHTML = md.render(raw);
  updateStatus(raw);
};

const updateStatus = (text) => {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const lines = text.split(/\n/).length;
  statusLeft.textContent = `${words} words`;
  statusRight.textContent = `${chars} chars · ${lines} lines`;
};

const scheduleRender = () => {
  if (renderScheduled) return;
  renderScheduled = true;
  const run = () => {
    renderScheduled = false;
    render();
  };
  if (window.requestIdleCallback) {
    window.requestIdleCallback(run, { timeout: 120 });
  } else {
    window.requestAnimationFrame(run);
  }
};

editor.on("change", scheduleRender);
editor.on("change", () => scheduleLiveSync());

// STEP-006: Scroll sync state with recursion guard
const scrollSyncState = {
  activeSource: null, // 'editor' or 'preview'
  isSyncing: false,
  pendingRaf: null,
  lastEditorScroll: 0,
  lastPreviewScroll: 0,
};

// STEP-006: Check if scroll sync should be enabled
const isScrollSyncEnabled = () => {
  // Disable sync when preview is not visible
  if (isMobile()) return false;
  if (document.body.classList.contains("focus")) return false;
  if (document.body.classList.contains("split-off")) return false;
  if (document.body.classList.contains("live-md")) return false;
  return true;
};

// STEP-006: Sync editor scroll to preview
const syncEditorToPreview = () => {
  if (scrollSyncState.isSyncing || !isScrollSyncEnabled()) return;

  const info = editor.getScrollInfo();
  const scrollRatio = info.top / (info.height - info.clientHeight || 1);
  const targetScrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);

  // Prevent recursion
  scrollSyncState.isSyncing = true;
  scrollSyncState.activeSource = 'editor';

  preview.scrollTop = targetScrollTop;
  scrollSyncState.lastPreviewScroll = preview.scrollTop;

  // Release guard after this frame
  if (scrollSyncState.pendingRaf) {
    cancelAnimationFrame(scrollSyncState.pendingRaf);
  }
  scrollSyncState.pendingRaf = requestAnimationFrame(() => {
    scrollSyncState.isSyncing = false;
    scrollSyncState.activeSource = null;
    scrollSyncState.pendingRaf = null;
  });
};

// STEP-006: Sync preview scroll to editor
const syncPreviewToEditor = () => {
  if (scrollSyncState.isSyncing || !isScrollSyncEnabled()) return;

  const scrollRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
  const info = editor.getScrollInfo();
  const targetScrollTop = scrollRatio * (info.height - info.clientHeight);

  // Prevent recursion
  scrollSyncState.isSyncing = true;
  scrollSyncState.activeSource = 'preview';

  editor.scrollTo(null, targetScrollTop);
  scrollSyncState.lastEditorScroll = editor.getScrollInfo().top;

  // Release guard after this frame
  if (scrollSyncState.pendingRaf) {
    cancelAnimationFrame(scrollSyncState.pendingRaf);
  }
  scrollSyncState.pendingRaf = requestAnimationFrame(() => {
    scrollSyncState.isSyncing = false;
    scrollSyncState.activeSource = null;
    scrollSyncState.pendingRaf = null;
  });
};

// STEP-006: Attach scroll handlers with guards
editor.on("scroll", syncEditorToPreview);
preview.addEventListener("scroll", syncPreviewToEditor);

// STEP-007: Cursor scrolloff - maintain 120px vertical breathing room
const CURSOR_SCROLL_MARGIN_PX = 120;

const applyCursorScrolloff = () => {
  const cursor = editor.getCursor();
  // scrollIntoView with margin will keep cursor away from viewport edges
  editor.scrollIntoView(
    { line: cursor.line, ch: cursor.ch },
    CURSOR_SCROLL_MARGIN_PX
  );
};

// Apply scrolloff on cursor activity and changes
editor.on("cursorActivity", applyCursorScrolloff);
editor.on("change", (_instance, changeObj) => {
  // Only apply on input changes (typing), not programmatic changes
  if (changeObj && (changeObj.origin === "+input" || changeObj.origin === "+delete")) {
    // Defer to let the editor update its layout first
    requestAnimationFrame(applyCursorScrolloff);
  }
});

// ============================================================
// File Operations
// ============================================================
const openFile = () => {
  fileInput.value = "";
  fileInput.click();
};

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    editor.setValue(e.target.result);
    const name = file.name.replace(/\.[^/.]+$/, "");
    docTitle.value = name || "Untitled";
    render();
  };
  reader.readAsText(file);
});

const saveFile = () => {
  const blob = new Blob([editor.getValue()], { type: "text/markdown" });
  const fileName = `${docTitle.value || "Untitled"}.md`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  updateLiveShare();
};

docTitle.addEventListener("input", () => scheduleLiveSync());
docTitle.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    docTitle.blur();
  }
});

// ============================================================
// Share Functionality
// ============================================================
const setShareResult = (url, isLive) => {
  shareUrlInput.value = url;
  shareCopyBtn.disabled = !url;
  shareUpdateBtn.disabled = !(isLive && shareState.id && shareState.editToken);
};

const scheduleLiveSync = () => {
  if (!shareState.id || shareState.type !== "live" || !shareState.editToken) return;
  if (liveSyncTimer) clearTimeout(liveSyncTimer);
  liveSyncTimer = setTimeout(() => updateLiveShare(), 1500);
};

const createShare = async () => {
  shareCreateBtn.disabled = true;
  shareError.textContent = "";
  const payload = {
    title: docTitle.value || "",
    content: editor.getValue(),
    shareType: shareTypeSelect.value,
    privacy: sharePrivacySelect.value,
  };
  try {
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("share failed");
    const data = await response.json();
    shareState.id = data.id;
    shareState.url = data.url;
    shareState.type = data.shareType;
    shareState.privacy = data.privacy;
    shareState.editToken = data.editToken || "";
    setShareResult(data.url, data.shareType === "live");
    if (data.shareType === "live" && !shareState.editToken) {
      shareError.textContent = "Live share needs an edit token. Create a new link.";
    }
  } catch (_) {
    setShareResult("", false);
    shareError.textContent = "Share service unavailable.";
  } finally {
    shareCreateBtn.disabled = false;
  }
};

const updateLiveShare = async () => {
  if (!shareState.id || shareState.type !== "live" || !shareState.editToken) return;
  const payload = {
    title: docTitle.value || "",
    content: editor.getValue(),
  };
  try {
    const response = await fetch(`/api/share/${shareState.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Share-Edit-Token": shareState.editToken,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if (shareModal.classList.contains("show")) {
        shareError.textContent = "Live share update failed.";
      }
      return;
    }
    const data = await response.json();
    shareState.url = data.url;
    setShareResult(data.url, true);
  } catch (_) {
    if (shareModal.classList.contains("show")) {
      shareError.textContent = "Live share update failed.";
    }
  }
};

// ============================================================
// Modal Handling (shared open/close logic)
// ============================================================
const openModal = (modal) => {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  if (vimEnabled) editor.setOption("keyMap", "default");
};

const closeModal = (modal) => {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  if (vimEnabled) editor.setOption("keyMap", "vim");
};

const openShareModal = () => {
  openModal(shareModal);
  shareTypeSelect.value = shareState.type;
  sharePrivacySelect.value = shareState.privacy;
  shareUrlInput.value = shareState.url;
  shareCopyBtn.disabled = !shareState.url;
  shareUpdateBtn.disabled = !(shareState.id && shareState.type === "live" && shareState.editToken);
  shareError.textContent = "";
};

const closeShareModal = () => closeModal(shareModal);
const openFontModal = () => openModal(fontModal);
const closeFontModal = () => closeModal(fontModal);
const openShortcutsModal = () => openModal(shortcutsModal);
const closeShortcutsModal = () => closeModal(shortcutsModal);

// Modal event listeners
[shareModal, fontModal, shortcutsModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });
  modal.addEventListener("keydown", (e) => e.stopPropagation());
});

shareClose.addEventListener("click", closeShareModal);
fontClose.addEventListener("click", closeFontModal);
shortcutsClose.addEventListener("click", closeShortcutsModal);

shareCreateBtn.addEventListener("click", createShare);
shareUpdateBtn.addEventListener("click", updateLiveShare);
shareCopyBtn.addEventListener("click", async () => {
  if (!shareState.url) return;
  try {
    await navigator.clipboard.writeText(shareState.url);
  } catch (_) {
    shareUrlInput.select();
    document.execCommand("copy");
  }
});

shareTypeSelect.addEventListener("change", (e) => {
  shareState.type = e.target.value;
  shareUpdateBtn.disabled = !(shareState.id && shareState.type === "live" && shareState.editToken);
});
sharePrivacySelect.addEventListener("change", (e) => {
  shareState.privacy = e.target.value;
});

fontBodySelect.addEventListener("change", (e) => applyFonts(e.target.value, fontMonoSelect.value));
fontMonoSelect.addEventListener("change", (e) => applyFonts(fontBodySelect.value, e.target.value));

// ============================================================
// Menu Handling
// ============================================================
const openMenu = () => {
  actionMenu.classList.add("show");
  menuBtn.setAttribute("aria-expanded", "true");
  actionMenu.setAttribute("aria-hidden", "false");
};

const closeMenu = () => {
  actionMenu.classList.remove("show");
  menuBtn.setAttribute("aria-expanded", "false");
  actionMenu.setAttribute("aria-hidden", "true");
};

const toggleMenu = () => {
  actionMenu.classList.contains("show") ? closeMenu() : openMenu();
};

menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu();
});

// Close menu on outside click
document.addEventListener("click", (e) => {
  if (!actionMenu.contains(e.target) && e.target !== menuBtn) {
    closeMenu();
  }
});

// Close menu on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && actionMenu.classList.contains("show")) {
    closeMenu();
    editor.focus();
  }
});

// Menu item handlers
menuOpen.addEventListener("click", () => {
  closeMenu();
  openFile();
});

menuSave.addEventListener("click", () => {
  closeMenu();
  saveFile();
});

menuSplit.addEventListener("click", () => {
  closeMenu();
  toggleSplit();
});

menuVim.addEventListener("click", () => {
  vimEnabled = !vimEnabled;
  editor.setOption("keyMap", vimEnabled ? "vim" : "default");
  syncVimButton();
  closeMenu();
  editor.focus();
});

menuTheme.addEventListener("click", () => {
  closeMenu();
  toggleTheme();
});

menuFonts.addEventListener("click", () => {
  closeMenu();
  openFontModal();
});

menuShortcuts.addEventListener("click", () => {
  closeMenu();
  openShortcutsModal();
});

menuShare.addEventListener("click", () => {
  closeMenu();
  openShareModal();
});

menuLiveMd.addEventListener("click", () => {
  closeMenu();
  toggleLiveMarkdown();
  editor.focus();
});

// ============================================================
// Split View
// ============================================================
const updateSplitButton = () => {
  if (isMobile()) {
    menuSplit.textContent = document.body.classList.contains("mobile-preview")
      ? "Editor"
      : "Preview";
  } else {
    menuSplit.textContent = document.body.classList.contains("split-off")
      ? "Split"
      : "Single";
  }
};

const toggleSplit = () => {
  // STEP-001: Live mode forces single pane - split toggle is disabled in live mode
  if (enableLiveMarkdown && !isMobile()) {
    return;
  }

  if (isMobile()) {
    document.body.classList.toggle("mobile-preview");
  } else {
    document.body.classList.toggle("split-off");
  }
  updateSplitButton();
  updateResizerVisibility();
  applyWidthTokens();
  editor.refresh();
};

window.addEventListener("resize", () => {
  updateSplitButton();
  updateResizerVisibility();
  applyWidthTokens();
});

// ============================================================
// Focus Mode
// ============================================================
const toggleFocus = () => {
  document.body.classList.toggle("focus");
  focusBtn.textContent = document.body.classList.contains("focus")
    ? "Exit Focus"
    : "Focus";
  updateResizerVisibility();
  applyWidthTokens();
};

focusBtn.addEventListener("click", toggleFocus);

// Trash / clear button (preserves undo history via replaceRange)
const trashBtn = document.getElementById("trash-btn");
trashBtn.addEventListener("click", () => {
  const content = editor.getValue();
  if (!content.trim()) return; // already empty
  if (!confirm("Clear all text? You can undo with Ctrl+Z.")) return;
  const lastLine = editor.lastLine();
  editor.replaceRange("", { line: 0, ch: 0 }, { line: lastLine, ch: editor.getLine(lastLine).length });
  docTitle.value = "Untitled";
  render();
  editor.focus();
});

// ============================================================
// Keyboard Shortcuts
// ============================================================
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const isModifier = event.metaKey || event.ctrlKey;

  if (isModifier && event.shiftKey && key === "s") {
    event.preventDefault();
    openShareModal();
    return;
  }
  if (isModifier && key === "s") {
    event.preventDefault();
    saveFile();
    return;
  }
  if (isModifier && key === "o") {
    event.preventDefault();
    openFile();
    return;
  }
  if (isModifier && key === "\\") {
    event.preventDefault();
    toggleSplit();
    return;
  }
  if (isModifier && event.shiftKey && key === "f") {
    event.preventDefault();
    toggleFocus();
    return;
  }
  if (isModifier && event.shiftKey && key === "v") {
    event.preventDefault();
    menuVim.click();
    return;
  }
  if (isModifier && event.shiftKey && key === "d") {
    event.preventDefault();
    toggleTheme();
    return;
  }
  if (isModifier && event.shiftKey && key === "l") {
    event.preventDefault();
    toggleLiveMarkdown();
    return;
  }
  if (isModifier && event.shiftKey && key === "m") {
    event.preventDefault();
    openFontModal();
    return;
  }
  if (isModifier && key === "/") {
    event.preventDefault();
    openShortcutsModal();
    return;
  }
  if (event.key === "Escape" && event.ctrlKey && document.body.classList.contains("focus")) {
    const vimState = editor.state.vim;
    if (vimState && vimState.insertMode) return;
    toggleFocus();
  }
});

// Auto-focus editor on unhandled key presses
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const active = document.activeElement;
  if (shareModal.classList.contains("show")) return;
  if (fontModal.classList.contains("show")) return;
  if (shortcutsModal.classList.contains("show")) return;
  if (actionMenu.classList.contains("show")) return;
  if (active && active.closest && active.closest(".CodeMirror")) return;
  if (active && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName)) return;
  editor.focus();
});

// ============================================================
// Init
// ============================================================
currentTheme = getInitialTheme();
applyTheme(currentTheme);
initFonts();
initLayout();
syncVimButton();
syncLiveMdButton();

// Default to single view (split-off)
document.body.classList.add("split-off");
updateSplitButton();
applyWidthTokens();

render();

window.addEventListener("load", () => {
  editor.focus();
  const end = editor.getValue().length;
  editor.setCursor(editor.posFromIndex(end));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});
