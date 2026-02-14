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

// Split resizer constants
const SPLIT_RATIO_KEY = "splitRatio";
const SPLIT_RATIO_DEFAULT = 0.5;
const SPLIT_RATIO_MIN = 0.3;
const SPLIT_RATIO_MAX = 0.7;
const SPLIT_KEYBOARD_STEP = 0.02;
const SPLIT_KEYBOARD_STEP_LARGE = 0.05;

// Split resizer runtime state
let splitRatio = SPLIT_RATIO_DEFAULT;
let isResizing = false;
let activePointerId = null;

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

const isEditorFocused = () => {
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

editor.on("scroll", () => {
  const info = editor.getScrollInfo();
  const ratio = info.top / (info.height - info.clientHeight || 1);
  preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
});

preview.addEventListener("scroll", () => {
  const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
  const info = editor.getScrollInfo();
  editor.scrollTo(null, ratio * (info.height - info.clientHeight));
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
  if (isMobile()) {
    document.body.classList.toggle("mobile-preview");
  } else {
    document.body.classList.toggle("split-off");
  }
  updateSplitButton();
  updateResizerVisibility();
  editor.refresh();
};

window.addEventListener("resize", () => {
  updateSplitButton();
  updateResizerVisibility();
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
};

focusBtn.addEventListener("click", toggleFocus);

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
    document.body.classList.remove("focus");
    focusBtn.textContent = "Focus";
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

// Default to single view (split-off)
document.body.classList.add("split-off");
updateSplitButton();

render();

window.addEventListener("load", () => {
  editor.focus();
  const end = editor.getValue().length;
  editor.setCursor(editor.posFromIndex(end));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});
