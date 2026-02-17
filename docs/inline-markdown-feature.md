# Inline Markdown Feature

## What this feature does

Inline markdown makes the editor pane behave like processed markdown while you type, without changing the underlying markdown source.

- Markdown delimiters are hidden when they are not actively being edited.
- Delimiters are revealed near the caret or inside a selection so editing stays safe.
- The visible text is styled inline (bold, italic, inline code, strike, link text) inside the editor itself.
- The right preview still exists, but the left editor is no longer only syntax highlighting.

## Supported syntax (current scope)

Inline tokens:

- strong: `**text**`, `__text__`
- emphasis: `*text*`, `_text_`
- inline code: `` `text` ``
- strikethrough: `~~text~~`
- links: `[label](url)`

Block markers (existing behavior preserved and integrated):

- headings: `#`
- unordered lists: `-`, `*`, `+`
- ordered lists: `1.`
- blockquote: `>`
- fences: ` ``` ` and `~~~`

## How it was implemented

### 1) Semantic delimiter engine (CodeMirror extension)

Main file: `src/editor/cm6/extensions/semantic-markdown.ts`

- Scans visible lines and active selection lines.
- Extracts delimiter ranges with deterministic ordering.
- Uses escape-aware parsing (for example, `\*` is not treated as a marker).
- Pairs inline markers with stack-based matching for open/close delimiters.
- Emits editor decorations with one of two classes:
  - `cm-md-delim-hidden`
  - `cm-md-delim-reveal`

### 2) Cursor-aware reveal policy

Still in `src/editor/cm6/extensions/semantic-markdown.ts`:

- If selection intersects a delimiter range, it is revealed.
- If caret is collapsed, delimiters in a small radius around the caret are revealed.
- Non-active delimiters are hidden.

This gives MarkText-like readability while preserving editability.

### 3) Styling layer

Styles live in `src/styles/editor/index.css`.

- Hidden delimiters collapse visually (`width: 0`, transparent, non-interactive).
- Revealed delimiters are visible for editing.

### 4) Runtime gating and mode behavior

Wiring in `src/main.ts`:

- Semantic inline rendering is attached only when all are true:
  - `useLiveMarkdown` feature flag enabled
  - `state.editor.liveMarkdown === true`
  - `state.editor.vimMode === false`
- Vim mode disables semantic inline rendering and restores normal behavior.

### 6) CM6 fenced code highlighting (non-live mode only)

Main files:

- `src/editor/cm6/extensions/fence-language-registry.ts`
- `src/editor/cm6/extensions/markdown.ts`
- `src/main.ts`

Behavior:

- Fenced highlighting is enabled only when all are true:
  - `useCM6=true`
  - `useFenceHighlighting=true`
  - `state.editor.liveMarkdown === false`
- Supported fenced language names are curated and centralized:
  - `java`
  - `javascript` / `js`
  - `typescript` / `ts`
  - `elixir`
  - `go` / `golang`
  - `ruby`
  - `python` / `py`
  - `php`
- Unknown fence names degrade safely to plaintext (no throw, no source mutation).

Compatibility notes:

- Live Markdown behavior remains unchanged.
- Preview rendering remains decoupled from editor parsing and still uses `src/utils/markdown.ts`.
- CM5 fallback path remains unchanged.

### 5) Coexistence with existing live rules

`src/editor/cm6/extensions/live-markdown.ts` remains responsible for structural transforms (for example spacing normalization for headings/lists/quotes). The semantic extension handles visibility and inline formatting behavior.

## Source fidelity and safety

The feature does not mutate markdown just to render visuals.

- Decorations are presentation-only.
- Save/export remains source-faithful markdown.
- Tests enforce byte-equality for saved output against editor source.

## Performance strategy

- Recomputes only on relevant editor updates:
  - document changes
  - selection changes
  - viewport changes
  - focus changes
- Processes viewport lines plus active selection lines (not full document every time).

## Testing coverage

Key tests added/updated:

- `tests/unit/editor/cm6/semantic-markdown.test.ts`
  - token coverage
  - ordered-list and blockquote behavior
  - strict idempotency with repeated no-op cycles
- `tests/integration/editor-live-markdown.test.ts`
  - mode-gating behavior
  - interleaving and malformed/nested cases
- `tests/e2e/invariants.spec.ts`
  - source fidelity for save/export

## Known limitations

- The delimiter parser is intentionally conservative and line-local.
- Some deeply complex nested markdown combinations may not visually match preview 100 percent yet.
- The system is designed to fail safe: if a pattern is ambiguous, source text remains intact.

## How to use

- Enable Live Markdown in the menu, or use the mapped shortcut for Live MD.
- Edit markdown normally in the left pane.
- Delimiters will hide/reveal based on caret/selection context.
