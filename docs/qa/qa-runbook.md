# QA Runbook

## Manual Testing Procedures

## Feature Flag Matrix (SC-001..SC-008)

| Stage                                 | useLiveMarkdown | useFenceHighlighting | useNewScrollSync | Status            | Evidence                                                                                                                                                                                                                                                            |
| ------------------------------------- | --------------- | -------------------- | ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal dev baseline                 | false           | false                | false            | PASS (2026-02-16) | `npm run typecheck` PASS; `npx playwright test tests/e2e/shortcuts.spec.ts tests/e2e/invariants.spec.ts --project=chromium` PASS (10/10); run ref `local-qa-2026-02-16-chromium-at007-at009`                                                                        |
| Staging semantic only                 | true            | false                | false            | PASS (2026-02-16) | `npx vitest run tests/unit/editor/cm6/semantic-markdown.test.ts` PASS (5/5); `npx vitest run tests/integration/editor-live-markdown.test.ts` PASS (5/5); `npx playwright test tests/e2e/invariants.spec.ts --project=chromium --grep "INV-001\|INV-007"` PASS (2/2) |
| Staging semantic + mapping sync       | true            | false                | true             | PASS (2026-02-16) | `npx vitest run tests/unit/ui/preview-source-map.test.ts` PASS (4/4); `npx vitest run tests/integration/scroll-sync-mapping.test.ts` PASS (3/3); `npx playwright test tests/e2e/invariants.spec.ts tests/e2e/editor.spec.ts --project=chromium` PASS (9/9)          |
| R1 internal non-live fence validation | false           | true                 | false            | PASS (2026-02-17) | `npm run typecheck` PASS; `npx vitest run tests/unit/editor/cm6/fence-language-registry.test.ts` PASS (3/3); `npx vitest run tests/unit/editor/cm6/markdown-fence-extension.test.ts tests/unit/editor/cm6/markdown-fence-gate.test.ts` PASS (4/4)                   |
| R2 staging non-live fence rollout     | false           | true                 | true             | PASS (2026-02-17) | `npx vitest run tests/integration/editor-fence-highlighting.test.ts tests/integration/editor-live-markdown.test.ts` PASS (10/10); `npx playwright test tests/e2e/invariants.spec.ts --project=chromium --grep "INV-001\|INV-003\|INV-007"` PASS (3/3)               |
| R3 staging live compatibility check   | true            | true                 | true             | PASS (2026-02-17) | `npx vitest run tests/integration/editor-live-markdown.test.ts` PASS (9/9); includes AT-COMP-001 gate + behavior checks under `fence=false` and `fence=true`                                                                                                        |
| CM5 fallback compatibility check      | false           | true                 | false            | PASS (2026-02-17) | `npx vitest run tests/integration/editor-engine-fallback.test.ts` PASS (2/2); asserts CM5 init path executes and `src/editor/cm6/extensions/fence-language-registry.ts` mock is not touched when `cm6=false`                                                        |

## EP-MD-INLINE-20260216-182938 Evidence (Historical, Superseded)

- Date: 2026-02-16
- `npm run typecheck`: PASS
- `npm run test:integration`: PASS (12/12)
- `npm run test:unit`: SUPERSEDED by `EP-CM6-FENCE-HIGHLIGHT-20260217-131614` evidence (`npm run test:unit` PASS, 20 files / 94 tests)
- Targeted unit/integration/e2e commands for inline semantic rendering and sync compatibility: PASS (see feature flag matrix rows for exact commands)

### Rollout Order

1. Internal dev validation with both flags off.
2. Internal validation with `useFenceHighlighting=true`, `useLiveMarkdown=false`.
3. Staging with `useFenceHighlighting=true`, `useLiveMarkdown=false`.
4. Staging compatibility check with `useFenceHighlighting=true`, `useLiveMarkdown=true`.
5. Gradual production enablement of `useFenceHighlighting`.

### Rollback Order

1. **RB-001**: Set `useFenceHighlighting=false` in `src/core/config.ts` and redeploy.
2. **RB-002**: If regression persists, revert STEP-005..STEP-001 changes in reverse order.
3. **RB-003**: Keep CM5 fallback unchanged during rollback verification.

### EP-CM6-FENCE-HIGHLIGHT-20260217-131614 Verification Commands

- `npm install --legacy-peer-deps`
- `npm run typecheck`
- `npx vitest run tests/unit/editor/cm6/fence-language-registry.test.ts`
- `npx vitest run tests/unit/editor/cm6/semantic-markdown.test.ts`
- `npx vitest run tests/unit/editor/cm6/markdown-fence-extension.test.ts`
- `npx vitest run tests/unit/core/config.test.ts`
- `npx vitest run tests/integration/editor-live-markdown.test.ts`
- `npx vitest run tests/unit/editor/cm6/markdown-fence-gate.test.ts`
- `npx vitest run tests/unit/editor/cm6/fence-language-registry.test.ts tests/integration/editor-fence-highlighting.test.ts`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npx playwright test tests/e2e/invariants.spec.ts --project=chromium`
- `npx playwright test tests/e2e/editor.spec.ts --project=chromium --grep "diagnostics"`

### EP-CM6-FENCE-HIGHLIGHT-20260217-131614 Evidence (2026-02-17)

- `npm install --legacy-peer-deps`: PASS (`up to date`, 0 vulnerabilities)
- `npm run typecheck`: PASS
- `npx vitest run tests/unit/editor/cm6/fence-language-registry.test.ts`: PASS (3/3)
- `npx vitest run tests/unit/editor/cm6/semantic-markdown.test.ts`: PASS (6/6)
- `npx vitest run tests/unit/editor/cm6/markdown-fence-extension.test.ts`: PASS (2/2)
- `npx vitest run tests/unit/core/config.test.ts`: PASS (2/2)
- `npx vitest run tests/integration/editor-live-markdown.test.ts`: PASS (9/9)
- `npx vitest run tests/unit/editor/cm6/markdown-fence-gate.test.ts`: PASS (2/2)
- `npx vitest run tests/unit/editor/cm6/fence-language-registry.test.ts tests/integration/editor-fence-highlighting.test.ts`: PASS (4/4)
- `npm run lint`: PASS (0 errors, warnings only)
- `npm run test:unit`: PASS (20 files, 94 tests)
- `npm run test:integration`: PASS (19/19)
- `npx playwright test tests/e2e/invariants.spec.ts --project=chromium`: PASS (7/7)
- `npx playwright test tests/e2e/editor.spec.ts --project=chromium --grep "diagnostics"`: PASS (1/1)

### Pre-release Checklist

Run through each section before releasing a new version.

## Editor Functionality

### Basic Editing

1. [ ] Type text in editor
2. [ ] Use arrow keys to navigate
3. [ ] Use Home/End to jump to line start/end
4. [ ] Use Page Up/Down to scroll
5. [ ] Copy/paste works
6. [ ] Undo/redo works (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)

### Markdown Features

1. [ ] Type `# Heading` - formats as heading
2. [ ] Type `- item` - creates bullet list
3. [ ] Type `1. item` - creates numbered list
4. [ ] Type `> quote` - creates blockquote
5. [ ] Type `` `code` `` - creates inline code
6. [ ] Type ` ``` ` - creates code fence

### Vim Mode (if enabled)

1. [ ] Toggle Vim mode on/off
2. [ ] Normal mode: hjkl navigation
3. [ ] Insert mode: type text
4. [ ] Visual mode: select text
5. [ ] Commands: :w, :q, dd, yy, p

### Live Markdown (if enabled)

1. [ ] Type `# test` + space → transforms to heading
2. [ ] Type `- test` + space → transforms to list
3. [ ] Empty list item + Enter → exits list
4. [ ] Undo reverses transformation

## Preview

### Rendering

1. [ ] Headings render correctly
2. [ ] Lists render correctly
3. [ ] Blockquotes render correctly
4. [ ] Code blocks render with highlighting
5. [ ] Links render as clickable
6. [ ] Images render

### Scroll Sync

1. [ ] Scroll editor → preview follows
2. [ ] Scroll preview → editor follows
3. [ ] No scroll jumping or infinite loops
4. [ ] Disabled on mobile
5. [ ] Disabled in single/focus mode

## UI and Layout

### Layout Modes

1. [ ] Split mode: both panes visible
2. [ ] Single mode: only editor visible
3. [ ] Focus mode: full-screen editor, chrome hidden
4. [ ] Mobile: toggle between editor and preview

### Menu

1. [ ] Click Menu button → menu opens
2. [ ] Click outside → menu closes
3. [ ] Press Escape → menu closes
4. [ ] Menu items work

### Modals

1. [ ] Open modals (Share, Fonts, Shortcuts)
2. [ ] Click outside → modal closes
3. [ ] Press Escape → modal closes
4. [ ] Click Close button → modal closes
5. [ ] Focus trapped inside modal

### Responsive

1. [ ] Test at 1920×1080 (desktop)
2. [ ] Test at 1366×768 (laptop)
3. [ ] Test at 768×1024 (tablet)
4. [ ] Test at 390×844 (mobile)
5. [ ] No horizontal overflow on mobile

## File Operations

### Save

1. [ ] Ctrl/Cmd+S triggers save
2. [ ] File saved as .md
3. [ ] Content is valid markdown
4. [ ] Filename includes document title

### Open

1. [ ] Ctrl/Cmd+O triggers open
2. [ ] Can select .md, .markdown, .txt files
3. [ ] Content loads into editor
4. [ ] Preview updates

## Share

### Static Share

1. [ ] Click Share → modal opens
2. [ ] Select "Static" type
3. [ ] Click Create → link generated
4. [ ] Copy link works
5. [ ] Link opens shared content

### Live Share

1. [ ] Select "Live" type
2. [ ] Click Create → link generated
3. [ ] Update button appears
4. [ ] Edit content
5. [ ] Click Update → content updated
6. [ ] Link reflects changes

### Security

1. [ ] Edit token NOT in localStorage
2. [ ] Edit token lost on reload
3. [ ] Cannot update without edit token

## Themes

### Light Theme

1. [ ] Colors render correctly
2. [ ] Editor theme is light
3. [ ] Preview is readable
4. [ ] Scrollbar visible

### Dark Theme

1. [ ] Toggle to dark mode
2. [ ] Colors render correctly
3. [ ] Editor theme is dark
4. [ ] Preview is readable
5. [ ] Scrollbar visible
6. [ ] Preference persists

## Keyboard Shortcuts

| Shortcut             | Test                                                            |
| -------------------- | --------------------------------------------------------------- |
| Ctrl/Cmd + S         | Save file                                                       |
| Ctrl/Cmd + O         | Open file                                                       |
| Ctrl/Cmd + \\        | Toggle split                                                    |
| Ctrl/Cmd + Shift + F | Focus mode                                                      |
| Ctrl + Esc           | Exit focus mode                                                 |
| Ctrl/Cmd + Shift + V | Toggle Vim                                                      |
| Ctrl/Cmd + Shift + D | Toggle theme                                                    |
| Ctrl/Cmd + Shift + M | Open fonts                                                      |
| Ctrl/Cmd + /         | Show shortcuts                                                  |
| F1                   | Show shortcuts                                                  |
| Ctrl/Cmd + Shift + L | Toggle live MD                                                  |
| Ctrl/Cmd + W         | Delete word before cursor (editor only, Alt+Backspace fallback) |

## Invariant Verification

### INV-001: Save produces valid markdown

1. Create document with various markdown elements
2. Save file
3. Open in another editor
4. Verify all formatting preserved

### INV-002: No share tokens in localStorage

1. Create live share
2. Open DevTools → Application → Local Storage
3. Verify no editToken or share_token keys
4. Reload page
5. Verify cannot update share (no token)

### INV-003: Keyboard-first workflow

1. Perform all major actions via keyboard
2. Verify no required mouse interactions
3. Verify auto-focus on keypress in focus mode

### INV-004: No mobile horizontal overflow

1. Open on mobile device or emulator
2. Verify no horizontal scroll
3. Verify content fits viewport

### INV-005: Accessibility

1. Navigate with Tab key
2. Verify focus indicators visible
3. Test with screen reader
4. Verify ARIA labels present

### INV-006: Share API contract

1. Monitor network requests
2. Verify request format unchanged
3. Verify response handling unchanged

### INV-007: Performance

1. Type rapidly - no lag
2. Open large document (>10k words)
3. Scroll smoothly at 60fps
4. Monitor memory usage

### INV-008: Quality gates

1. Run `npm test` - all pass
2. Run `npm run lint` - no errors
3. Run `npm run build` - success
4. Verify no console errors

## Remediation Rollback Procedure (ADR-009)

1. **RB-001**: Set `useFenceHighlighting=false` in `src/core/config.ts` and redeploy first (minimal blast radius).
2. **RB-002**: If regression persists, revert STEP-005..STEP-001 changes in reverse order.
3. **RB-003**: Do not modify CM5 fallback during rollback.
4. Run rollback verification commands:
   - `npx vitest run tests/integration/editor-live-markdown.test.ts`
   - `npm run typecheck`
   - `npx playwright test tests/e2e/invariants.spec.ts --project=chromium`
   - `npx vitest run tests/integration/editor-engine-fallback.test.ts`
5. Record rollback reason, commit hash, and affected steps in this runbook and link the record to `docs/adr/ADR-009.md`.

## Bug Report Template

```
**Environment**
- Browser: [Chrome/Firefox/Safari]
- Version: [e.g., 120.0]
- OS: [Windows/macOS/Linux]
- Screen size: [e.g., 1920x1080]

**Steps to Reproduce**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Screenshots**
If applicable

**Console Errors**
Any errors in DevTools console
```
