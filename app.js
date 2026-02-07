const editorRoot = document.getElementById("editor");
const preview = document.getElementById("preview");
const fileInput = document.getElementById("file-input");
const docTitle = document.getElementById("doc-title");
const statusLeft = document.getElementById("status-left");
const statusRight = document.getElementById("status-right");
const splitBtn = document.getElementById("split-btn");
const focusBtn = document.getElementById("focus-btn");
const openBtn = document.getElementById("open-btn");
const saveBtn = document.getElementById("save-btn");
const vimBtn = document.getElementById("vim-btn");
const shareBtn = document.getElementById("share-btn");
const themeBtn = document.getElementById("theme-btn");
const shareModal = document.getElementById("share-modal");
const shareClose = document.getElementById("share-close");
const shareTypeSelect = document.getElementById("share-type");
const sharePrivacySelect = document.getElementById("share-privacy");
const shareCreateBtn = document.getElementById("share-create");
const shareUpdateBtn = document.getElementById("share-update");
const shareUrlInput = document.getElementById("share-url");
const shareCopyBtn = document.getElementById("share-copy");
const shareError = document.getElementById("share-error");
const fontBtn = document.getElementById("font-btn");
const fontModal = document.getElementById("font-modal");
const fontClose = document.getElementById("font-close");
const fontBodySelect = document.getElementById("font-body");
const fontMonoSelect = document.getElementById("font-mono");
const shortcutsBtn = document.getElementById("shortcuts-btn");
const shortcutsModal = document.getElementById("shortcuts-modal");
const shortcutsClose = document.getElementById("shortcuts-close");
const layoutBtn = document.getElementById("layout-btn");
const layoutModal = document.getElementById("layout-modal");
const layoutClose = document.getElementById("layout-close");
const layoutWidth = document.getElementById("layout-width");

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

const starter = `# Typim\n\nWelcome to a focused markdown space.\n\n## Quick start\n- Write markdown on the left\n- Preview updates instantly on the right\n- Save with Ctrl+S or Cmd+S\n\n> Tip: Use **bold**, _italic_, and inline code with single backticks.\n\n### Task list\n- [x] Clean layout\n- [ ] Your next idea\n\n\`\`\`js\nfunction hello() {\n  return "Hello";\n}\n\`\`\`\n`;

const editor = window.CodeMirror(editorRoot, {
  value: starter,
  mode: "markdown",
  theme: "xq-light",
  lineWrapping: true,
  lineNumbers: false,
  keyMap: "default",
});

let vimEnabled = false;
const shareState = {
  id: null,
  url: "",
  type: "static",
  privacy: "secret",
  editToken: "",
};
const syncVimButton = () => {
  vimBtn.textContent = vimEnabled ? "Vim: On" : "Vim: Off";
};
syncVimButton();

let renderScheduled = false;
let lastValue = null;
let liveSyncTimer = null;
const fontOptions = {
  body: {
    serif: '"IBM Plex Serif", "Georgia", serif',
    sans: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  mono: {
    plex: '"IBM Plex Mono", "SFMono-Regular", "Menlo", "Consolas", monospace',
    system: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
};

const getInitialTheme = () => {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

let currentTheme = getInitialTheme();
const applyTheme = (theme) => {
  currentTheme = theme;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (theme === "dark") {
    document.body.setAttribute("data-theme", "dark");
    themeBtn.textContent = "Theme: Dark";
    editor.setOption("theme", "xq-dark");
    if (themeMeta) {
      themeMeta.setAttribute("content", "#1f1c18");
    }
  } else {
    document.body.removeAttribute("data-theme");
    themeBtn.textContent = "Theme: Light";
    editor.setOption("theme", "xq-light");
    if (themeMeta) {
      themeMeta.setAttribute("content", "#f2efe9");
    }
  }
  localStorage.setItem("theme", theme);
};

themeBtn.addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

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

const applyLayoutWidth = (value) => {
  const width = Number(value) || 1400;
  document.documentElement.style.setProperty("--container-width", `${width}px`);
  localStorage.setItem("layoutWidth", String(width));
};

const initLayout = () => {
  const stored = localStorage.getItem("layoutWidth");
  const width = stored ? Number(stored) : 1400;
  layoutWidth.value = String(width || 1400);
  applyLayoutWidth(width || 1400);
};

applyTheme(currentTheme);
initFonts();
initLayout();

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
editor.on("change", () => {
  scheduleLiveSync();
});

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

docTitle.addEventListener("input", () => {
  scheduleLiveSync();
});

docTitle.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    docTitle.blur();
  }
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

openBtn.addEventListener("click", openFile);
saveBtn.addEventListener("click", saveFile);

vimBtn.addEventListener("click", () => {
  vimEnabled = !vimEnabled;
  editor.setOption("keyMap", vimEnabled ? "vim" : "default");
  syncVimButton();
  editor.focus();
});

const openShareModal = () => {
  shareModal.classList.add("show");
  shareModal.setAttribute("aria-hidden", "false");
  shareTypeSelect.value = shareState.type;
  sharePrivacySelect.value = shareState.privacy;
  shareUrlInput.value = shareState.url;
  shareCopyBtn.disabled = !shareState.url;
  shareUpdateBtn.disabled = !(shareState.id && shareState.type === "live" && shareState.editToken);
  shareError.textContent = "";
  if (vimEnabled) {
    editor.setOption("keyMap", "default");
  }
};

const closeShareModal = () => {
  shareModal.classList.remove("show");
  shareModal.setAttribute("aria-hidden", "true");
  if (vimEnabled) {
    editor.setOption("keyMap", "vim");
  }
};

const openFontModal = () => {
  fontModal.classList.add("show");
  fontModal.setAttribute("aria-hidden", "false");
  if (vimEnabled) {
    editor.setOption("keyMap", "default");
  }
};

const closeFontModal = () => {
  fontModal.classList.remove("show");
  fontModal.setAttribute("aria-hidden", "true");
  if (vimEnabled) {
    editor.setOption("keyMap", "vim");
  }
};

const openShortcutsModal = () => {
  shortcutsModal.classList.add("show");
  shortcutsModal.setAttribute("aria-hidden", "false");
  if (vimEnabled) {
    editor.setOption("keyMap", "default");
  }
};

const closeShortcutsModal = () => {
  shortcutsModal.classList.remove("show");
  shortcutsModal.setAttribute("aria-hidden", "true");
  if (vimEnabled) {
    editor.setOption("keyMap", "vim");
  }
};

const openLayoutModal = () => {
  layoutModal.classList.add("show");
  layoutModal.setAttribute("aria-hidden", "false");
  if (vimEnabled) {
    editor.setOption("keyMap", "default");
  }
};

const closeLayoutModal = () => {
  layoutModal.classList.remove("show");
  layoutModal.setAttribute("aria-hidden", "true");
  if (vimEnabled) {
    editor.setOption("keyMap", "vim");
  }
};

const setShareResult = (url, isLive) => {
  shareUrlInput.value = url;
  shareCopyBtn.disabled = !url;
  shareUpdateBtn.disabled = !(isLive && shareState.id && shareState.editToken);
};

const scheduleLiveSync = () => {
  if (!shareState.id || shareState.type !== "live" || !shareState.editToken) return;
  if (liveSyncTimer) {
    clearTimeout(liveSyncTimer);
  }
  liveSyncTimer = setTimeout(() => {
    updateLiveShare();
  }, 1500);
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
    if (!response.ok) {
      throw new Error("share failed");
    }
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
    return;
  }
};

shareBtn.addEventListener("click", openShareModal);
shareClose.addEventListener("click", closeShareModal);
shareModal.addEventListener("click", (event) => {
  if (event.target === shareModal) {
    closeShareModal();
  }
});
shareModal.addEventListener("keydown", (event) => {
  event.stopPropagation();
});
fontBtn.addEventListener("click", openFontModal);
fontClose.addEventListener("click", closeFontModal);
fontModal.addEventListener("click", (event) => {
  if (event.target === fontModal) {
    closeFontModal();
  }
});
fontModal.addEventListener("keydown", (event) => {
  event.stopPropagation();
});
shortcutsBtn.addEventListener("click", openShortcutsModal);
shortcutsClose.addEventListener("click", closeShortcutsModal);
shortcutsModal.addEventListener("click", (event) => {
  if (event.target === shortcutsModal) {
    closeShortcutsModal();
  }
});
shortcutsModal.addEventListener("keydown", (event) => {
  event.stopPropagation();
});
layoutBtn.addEventListener("click", openLayoutModal);
layoutClose.addEventListener("click", closeLayoutModal);
layoutModal.addEventListener("click", (event) => {
  if (event.target === layoutModal) {
    closeLayoutModal();
  }
});
layoutModal.addEventListener("keydown", (event) => {
  event.stopPropagation();
});
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

shareTypeSelect.addEventListener("change", (event) => {
  shareState.type = event.target.value;
  shareUpdateBtn.disabled = !(shareState.id && shareState.type === "live" && shareState.editToken);
});

sharePrivacySelect.addEventListener("change", (event) => {
  shareState.privacy = event.target.value;
});

fontBodySelect.addEventListener("change", (event) => {
  applyFonts(event.target.value, fontMonoSelect.value);
});

fontMonoSelect.addEventListener("change", (event) => {
  applyFonts(fontBodySelect.value, event.target.value);
});

layoutWidth.addEventListener("input", (event) => {
  applyLayoutWidth(event.target.value);
});

const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

const updateSplitButton = () => {
  if (isMobile()) {
    splitBtn.textContent = document.body.classList.contains("mobile-preview")
      ? "Editor"
      : "Preview";
  } else {
    splitBtn.textContent = document.body.classList.contains("split-off")
      ? "Split"
      : "Single";
  }
};

splitBtn.addEventListener("click", () => {
  if (isMobile()) {
    document.body.classList.toggle("mobile-preview");
  } else {
    document.body.classList.toggle("split-off");
  }
  updateSplitButton();
});

window.addEventListener("resize", updateSplitButton);

focusBtn.addEventListener("click", () => {
  document.body.classList.toggle("focus");
  focusBtn.textContent = document.body.classList.contains("focus")
    ? "Exit Focus"
    : "Focus";
});

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
    splitBtn.click();
    return;
  }
  if (isModifier && event.shiftKey && key === "f") {
    event.preventDefault();
    focusBtn.click();
    return;
  }
  if (isModifier && event.shiftKey && key === "v") {
    event.preventDefault();
    vimBtn.click();
    return;
  }
  if (isModifier && event.shiftKey && key === "d") {
    event.preventDefault();
    themeBtn.click();
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

render();
updateSplitButton();
window.addEventListener("load", () => {
  editor.focus();
  const end = editor.getValue().length;
  editor.setCursor(editor.posFromIndex(end));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const active = document.activeElement;
  if (shareModal.classList.contains("show")) return;
  if (fontModal.classList.contains("show")) return;
  if (shortcutsModal.classList.contains("show")) return;
  if (layoutModal.classList.contains("show")) return;
  if (active && active.closest && active.closest(".CodeMirror")) return;
  if (active && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName)) return;
  editor.focus();
});
