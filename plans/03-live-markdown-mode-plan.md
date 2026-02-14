# Plan 03 - Live markdown mode

## GOAL

Implement a live markdown editing mode where simple markdown transforms happen as you type (similar to Notion or Obsidian), without leaving the writing flow.

## SCOPE (in / out)

In scope:
- Frontend only: `index.html`, `styles.css`, `app.js`
- Real-time markdown transformation on `space` and `enter` triggers
- Input rules for: headings, lists, blockquotes, code blocks, horizontal rules
- Feature flag support for gradual rollout
- Save and share must continue to work with markdown content

Out of scope:
- Backend changes (`../typim-share-api`)
- Token storage changes
- Full WYSIWYG toolbar (this is keyboard-first flow)
- Mobile-specific live mode behavior changes (keep existing mobile experience)

## CONSTRAINTS & ASSUMPTIONS

- The editor must remain keyboard-first and minimal.
- Vim mode compatibility is a secondary priority (feature may initially disable live mode in Vim or require special handling).
- Content must remain valid markdown for save and share.
- No new persistent storage of tokens or credentials.
- If transformation is ambiguous, prefer keeping raw text (user can retype).
- Performance must not degrade on documents up to 10k words.

## STEPS

1. Design transformation rules
   - Define exact regex patterns for each trigger.
   - Examples: `# ` -> h1, `## ` -> h2, `- ` -> ul, `> ` -> blockquote, ````` -> code fence.
   - Document precedence when multiple patterns could match.

2. Add feature flag infrastructure
   - Add `enableLiveMarkdown` boolean toggle (menu item or setting).
   - Default to false until stable.
   - Persist preference locally, never persist tokens.

3. Implement input watcher
   - Hook into CodeMirror `inputRead` or `beforeChange` events.
   - Detect space/enter at line start with matching pattern.
   - Transform line atomically: replace raw pattern with rendered token.

4. Handle each transformation type
   - Headings: wrap line in h1/h2/h3 with appropriate styling classes.
   - Lists: convert `- ` or `* ` or `1. ` into list structure, auto-continue on next line.
   - Blockquotes: `> ` becomes quote block, support nesting.
   - Code fences: triple backticks open/close code block with highlight.js.
   - Horizontal rule: `---` becomes visual divider.

5. Implement exit behavior
   - Empty line in list exits list (like Notion).
   - Double enter in quote exits quote.
   - Preserve cursor position correctly after transformations.

6. Sync with preview and status
   - Update word/char counts after transformations.
   - Keep live preview sync functional.

7. Vim mode compatibility
   - Detect if Vim keymap active.
   - Either disable live transforms in Vim initially or map carefully to avoid conflicts.
   - Document Vim behavior in shortcuts/help.

8. QA and edge cases
   - Undo/redo must handle transformations correctly.
   - Copy-paste with markdown must transform on paste or preserve raw (decide and document).
   - Mixed RTL content must not break.

## RISKS

- Risk: Vim keymap conflicts make editing confusing.
  - Mitigation: disable live mode when Vim is on, or provide clear toggle.

- Risk: Transformations feel unpredictable to users.
  - Mitigation: start with conservative pattern set, add opt-in for aggressive rules.

- Risk: Performance degradation in long documents.
  - Mitigation: limit live transforms to visible viewport, debounce heavy operations.

- Risk: Undo history becomes fragmented or broken.
  - Mitigation: use atomic replaceRange operations with origin markers.

- Risk: Content becomes invalid markdown after transforms.
  - Mitigation: validate output with markdown-it roundtrip in tests.

## QA / ACCEPTANCE CRITERIA

- AC-01: Typing `# Title` + space transforms to visual h1 immediately.
- AC-02: Typing `- item` + space creates bullet list with proper indentation.
- AC-03: Pressing enter in list creates next bullet; empty bullet + enter exits list.
- AC-04: Code fences open and close correctly with syntax highlighting.
- AC-05: Save file produces valid markdown identical to visual representation.
- AC-06: Share creates static/live share with correct markdown content.
- AC-07: Vim mode does not break when live mode is enabled (either disabled or mapped safely).
- AC-08: Feature flag can disable all live transforms instantly.
- AC-09: No share tokens or credentials are stored in new code paths.

Manual QA scenarios:
- Type through all patterns in single paragraph mode.
- Type through all patterns in split view with preview visible.
- Test nested structures (list inside quote).
- Test undo/redo after transformations.
- Test save/open roundtrip.

## OPEN QUESTIONS

- Should live mode be default on for new users, or opt-in?
- Should we preserve raw markdown characters visible (hybrid) or hide them completely (pure WYSIWYG)?
- How should Vim operators interact with transformed blocks (for example `dd` on a heading)?
