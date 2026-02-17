import { EditorView } from '@codemirror/view';

const baseThemeSpec = {
  '&': {
    backgroundColor: 'var(--color-editor-bg)',
    color: 'var(--color-text-primary)',
  },
  '.cm-content': {
    caretColor: 'var(--color-editor-cursor)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-editor-cursor)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--color-editor-selection)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--color-editor-selection)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-editor-gutter)',
    color: 'var(--color-text-tertiary)',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-secondary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--color-bg-secondary)',
  },
  '.cm-keyword': { color: 'var(--color-syntax-keyword)' },
  '.cm-string': { color: 'var(--color-syntax-string)' },
  '.cm-comment': { color: 'var(--color-syntax-comment)', fontStyle: 'italic' },
  '.cm-variableName': { color: 'var(--color-syntax-function)' },
  '.cm-number': { color: 'var(--color-syntax-number)' },
  '.cm-heading': { color: 'var(--color-text-primary)', fontWeight: 'bold' },
  '.cm-quote': { color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  '.cm-link': { color: 'var(--color-accent-primary)', textDecoration: 'underline' },
  '.cm-strong': { fontWeight: 'bold' },
  '.cm-emphasis': { fontStyle: 'italic' },
};

export const lightTheme = EditorView.theme(baseThemeSpec, { dark: false });
export const darkTheme = EditorView.theme(baseThemeSpec, { dark: true });

export function getThemeExtension(theme: 'light' | 'dark') {
  return theme === 'dark' ? darkTheme : lightTheme;
}

export const highlightStyle = EditorView.theme({
  '.cm-markdown-heading': {
    fontWeight: 'bold',
  },
  '.cm-markdown-code': {
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--color-preview-code-bg)',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-sm)',
  },
  '.cm-markdown-link': {
    color: 'var(--color-accent-primary)',
    textDecoration: 'underline',
  },
});
