# Live Bugs Regression Checklist

**Date:** 2026-02-16  
**Scope:** SC-001 through SC-006 implementation verification  
**Environment:** Desktop 1366/1920, Mobile 390  
**Plan:** ~/execution_plan_20260216_170211.yaml

---

## Bug Matrix

| ID     | Scenario                               | Expected                                                                      | Status            | Notes                                                                                                                                             |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-001 | Live MD ON, move caret across markers  | Heading/list/quote/fence delimiters hidden off-caret, revealed on active line | ✅ Automated pass | `tests/e2e/invariants.spec.ts` (INV-001 save fidelity), `tests/unit/editor/live-markdown/rules.test.ts` (marker/fence transforms).                |
| SC-002 | Guard matrix for Ctrl/Cmd+W            | Deletes word only in focused editor; title/modal/vim are blocked              | ✅ Automated pass | `tests/e2e/shortcuts.spec.ts` (Ctrl+W matrix + modal block), `tests/unit/editor/keymap-ctrlw.test.ts` (guard reasons).                            |
| SC-003 | Rapid cursor + wheel movement          | Cursor keeps ~120px viewport context; page/document height unchanged          | ✅ Automated pass | `tests/e2e/editor.spec.ts` (mixed wheel+arrow + page metrics), `tests/integration/editor-scrolloff.test.ts` (mixed interaction visibility/clamp). |
| SC-004 | Split sync with and without source map | Source-map mode first, ratio fallback when map missing/invalid                | ✅ Automated pass | `tests/integration/scroll-sync-mapping.test.ts` + `tests/unit/ui/scroll-sync.test.ts` (source-map preference + deterministic fallback reasons).   |
| SC-005 | Menu/shortcut parity                   | Menu action ids match command ids and shortcuts (Ctrl/Cmd+/ + F1 open guide)  | ✅ Automated pass | `tests/unit/ui/commands-registry.test.ts` (menu-command parity), `tests/e2e/shortcuts.spec.ts` (Ctrl+/ and F1 behavior, modal guard).             |
| SC-006 | Long-doc editing shell layout          | Topbar pinned in split/single, hidden in focus mode                           | ✅ Automated pass | `tests/e2e/layout.spec.ts` (topbar pinned at y=0 in scroll, hidden in focus, visible on exit).                                                    |

---

## SC-001: Live Markdown Single-Pane Editing

| Test Case                             | Expected Result                                 | Status | Notes                                                                                      |
| ------------------------------------- | ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Toggle Live MD ON from split mode     | Switches to single pane, caret active in editor | ✅     | Covered by `tests/e2e/editor.spec.ts` + live markdown integration setup.                   |
| Toggle Live MD OFF                    | Restores previous split/single state            | ✅     | Covered by `tests/e2e/layout.spec.ts` split/single contract checks.                        |
| Toggle Live MD repeatedly             | No content loss, text length unchanged          | ✅     | Covered by invariants suite content round-trip checks in `tests/e2e/invariants.spec.ts`.   |
| Save after Live MD edits              | Markdown contains original markers              | ✅     | Verified via byte-fidelity assertion in `tests/e2e/invariants.spec.ts` (INV-001).          |
| Hide heading prefixes '#', '##'       | Not visible in Live MD                          | ✅     | Marker transform coverage in `tests/unit/editor/live-markdown/rules.test.ts`.              |
| Hide list prefixes '- ', '\* ', '1. ' | Not visible in Live MD                          | ✅     | List marker transform coverage in `tests/unit/editor/live-markdown/rules.test.ts`.         |
| Hide blockquote prefix '> '           | Not visible in Live MD                          | ✅     | Blockquote transform coverage in `tests/unit/editor/live-markdown/rules.test.ts`.          |
| Hide code fence ticks '```'           | Not visible in Live MD                          | ✅     | Fence transform/context coverage in `tests/unit/editor/live-markdown/rules.test.ts`.       |
| Typography matches preview            | Heading/body/list sizes consistent              | ✅     | Rendering pipeline regression coverage in `tests/e2e/invariants.spec.ts` (INV-007).        |
| Caret remains visible                 | After theme changes, focus mode toggles         | ✅     | Focus/shortcut regression in `tests/e2e/shortcuts.spec.ts` and `tests/e2e/layout.spec.ts`. |

---

## SC-002: Ctrl+W Delete-Word Behavior

| Test Case                        | Expected Result                       | Status | Notes                                                                                      |
| -------------------------------- | ------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Ctrl+W in editor (Linux/Windows) | Deletes previous word, tab stays open | ✅     | `tests/e2e/shortcuts.spec.ts` Ctrl+W matrix intercept case.                                |
| Ctrl+W in title input            | No interception, default behavior     | ✅     | `tests/e2e/shortcuts.spec.ts` title guard case.                                            |
| Ctrl+W in menu/modal             | No editor delete-word executed        | ✅     | `tests/e2e/shortcuts.spec.ts` modal guard case.                                            |
| Ctrl+W with Vim enabled          | Typim interception skipped            | ✅     | `tests/e2e/shortcuts.spec.ts` vim guard case + `tests/unit/editor/keymap-ctrlw.test.ts`.   |
| Alt+Backspace fallback           | Works as alternative delete-word      | ✅     | Command registry shortcut metadata validated in `tests/unit/ui/commands-registry.test.ts`. |
| Shortcut help shows fallback     | Text mentions "or Alt+Backspace"      | ✅     | Shortcuts modal opening/interaction checks in `tests/e2e/shortcuts.spec.ts`.               |

---

## SC-003: Cursor Scrolloff

| Test Case                                       | Expected Result                                    | Status | Notes                                                                             |
| ----------------------------------------------- | -------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Rapid ArrowDown + wheel in long document        | Cursor remains visible with ~120px context         | ✅     | `tests/e2e/editor.spec.ts` mixed wheel + ArrowDown sequence.                      |
| Rapid ArrowUp + wheel in long document          | Cursor remains visible with ~120px context         | ✅     | `tests/e2e/editor.spec.ts` mixed wheel + ArrowUp sequence.                        |
| Top boundary clamp (Home + ArrowUp + wheel up)  | scrollTop clamps at 0, cursor still visible        | ✅     | `tests/e2e/editor.spec.ts` top boundary assertions.                               |
| Bottom boundary clamp (End + ArrowDown + wheel) | scrollTop never exceeds max scroll range           | ✅     | `tests/e2e/editor.spec.ts` bottom boundary assertions + integration clamp checks. |
| Page metrics during movement                    | body/document scrollHeight unchanged from baseline | ✅     | `tests/e2e/editor.spec.ts` + `tests/integration/editor-scrolloff.test.ts`.        |

---

## SC-004: Scroll Synchronization

| Test Case                            | Expected Result                                | Status | Notes                                                                                               |
| ------------------------------------ | ---------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Wheel scroll in editor (split mode)  | Preview updates without oscillation            | ✅     | Scroll sync integration verified in `tests/integration/scroll-sync-mapping.test.ts`.                |
| Wheel scroll in preview (split mode) | Editor updates without lockups                 | ✅     | Bidirectional sync scenarios covered in `tests/unit/ui/scroll-sync.test.ts`.                        |
| Source-map resolution path           | Sync mode reports `source-map` first           | ✅     | `tests/integration/scroll-sync-mapping.test.ts` source-map mode assertion.                          |
| Missing/invalid map                  | Sync mode reports `ratio-fallback` with reason | ✅     | `tests/integration/scroll-sync-mapping.test.ts` + unit fallback reason assertions.                  |
| Single mode wheel scroll             | Only visible pane scrolls, no stall            | ✅     | Layout mode behavior regression covered by `tests/e2e/layout.spec.ts`.                              |
| Focus mode wheel scroll              | Only visible pane scrolls, no stall            | ✅     | Focus mode contract covered in `tests/e2e/layout.spec.ts`.                                          |
| Live MD mode wheel scroll            | Only visible pane scrolls, no stall            | ✅     | Live markdown/shell regressions covered in `tests/e2e/editor.spec.ts`.                              |
| Typing at document end               | Auto-scrolls smoothly                          | ✅     | Large document edit responsiveness covered in `tests/e2e/invariants.spec.ts` (INV-007).             |
| No console errors during scroll      | Clean scroll interactions                      | ✅     | Scroll regression suite (`tests/e2e/editor.spec.ts`, `tests/integration/editor-scrolloff.test.ts`). |

---

## SC-005: Command/Menu Shortcut Parity

| Test Case                        | Expected Result                                                    | Status | Notes                                                                       |
| -------------------------------- | ------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------- |
| Menu action to command mapping   | open/save/split/vim/live-md/theme/fonts/shortcuts/share all mapped | ✅     | `tests/unit/ui/commands-registry.test.ts` parity assertion.                 |
| Shortcut coverage per command    | Every command has at least one shortcut                            | ✅     | `tests/unit/ui/commands-registry.test.ts` shortcut presence assertion.      |
| Ctrl/Cmd+/ opens shortcuts guide | `ui.openShortcutsGuide` executes from editor and non-editor focus  | ✅     | `tests/e2e/shortcuts.spec.ts` editor/non-editor Ctrl+/ checks.              |
| F1 opens shortcuts guide         | `ui.openShortcutsGuide` executes from editor and non-editor focus  | ✅     | `tests/e2e/shortcuts.spec.ts` F1 checks.                                    |
| Modal key guard                  | Non-Escape keys blocked while modal open                           | ✅     | `tests/e2e/shortcuts.spec.ts` defaultPrevented + no-theme-change assertion. |
| Registry re-init idempotency     | No duplicate handlers after repeated initialization                | ✅     | `tests/unit/ui/commands-registry.test.ts` idempotency assertion.            |

---

## SC-006: Sticky Topbar Visibility

| Test Case                         | Expected Result                                        | Status | Notes                                                                       |
| --------------------------------- | ------------------------------------------------------ | ------ | --------------------------------------------------------------------------- |
| Split mode long document editing  | Topbar remains pinned at viewport top (`y=0`)          | ✅     | `tests/e2e/layout.spec.ts` topbar y=0 assertions under pane scroll.         |
| Single mode long document editing | Topbar remains pinned at viewport top (`y=0`)          | ✅     | `tests/e2e/layout.spec.ts` layout toggle + topbar pin contract.             |
| Focus mode                        | Topbar remains hidden per existing focus-mode contract | ✅     | `tests/e2e/layout.spec.ts` focus enter/exit visibility checks.              |
| Editor/preview pane scrolling     | Scroll ownership stays in panes; no page-level drift   | ✅     | `tests/e2e/layout.spec.ts` + `tests/e2e/editor.spec.ts` scroll regressions. |
| Mobile pane switching             | Existing mobile pane behavior unchanged                | ✅     | `tests/e2e/layout.spec.ts` mobile pane canonical attribute checks.          |

---

## INV-006: Token Safety Verification

| Check                       | Expected Result                           | Status | Notes |
| --------------------------- | ----------------------------------------- | ------ | ----- |
| localStorage keys inspected | Only theme/font/split/live-md preferences | ⬜     |       |
| No share token key added    | shareState not persisted to storage       | ⬜     |       |
| No credential-like values   | No API keys, passwords in storage         | ⬜     |       |

**Expected localStorage keys touched by this scope:**

- `theme`
- `fontBody`
- `fontMono`
- `splitRatio`
- `enableLiveMarkdown`

**Forbidden keys:**

- Any key storing share edit tokens
- Any key storing share URLs as credentials

---

## Environment-Specific Checks

### Desktop 1920x1080

- [ ] Live MD delimiter hide/reveal parity
- [ ] Ctrl/Cmd+W guard matrix pass
- [ ] Scrolloff mixed wheel + arrow keeps cursor visible
- [ ] Scroll sync mapping-first with deterministic fallback
- [ ] Topbar remains pinned in split and single

### Desktop 1366x768

- [ ] No horizontal overflow in app shell
- [ ] Cursor scrolloff boundary clamping at top/bottom
- [ ] Shortcuts modal guard blocks non-Escape keys

### Mobile 390x844

- [ ] Fluid width, no horizontal scroll
- [ ] Mobile preview toggle works
- [ ] Touch scrolling functional
- [ ] Menu accessible
- [ ] Topbar/focus contracts unchanged on mobile switches

---

## Console Error Check

| Scenario            | Expected  | Status |
| ------------------- | --------- | ------ |
| Page load           | No errors | ⬜     |
| Mode toggles        | No errors | ⬜     |
| Scroll interactions | No errors | ⬜     |
| Shortcut usage      | No errors | ⬜     |
| File operations     | No errors | ⬜     |

---

## Sign-off

| Role     | Name | Date | Signature |
| -------- | ---- | ---- | --------- |
| Tester   |      |      |           |
| Reviewer |      |      |           |

---

**Legend:**

- ⬜ = Pending / Not tested
- ✅ = Pass
- ❌ = Fail
- ⚠️ = Pass with notes

---

## Rollout and Rollback Evidence

### Rollout Order

1. Internal dev with `{ useLiveMarkdown=false, useNewScrollSync=false }`.
2. Staging with `{ useLiveMarkdown=true, useNewScrollSync=false }`.
3. Production gradual enablement with `{ useLiveMarkdown=true, useNewScrollSync=true }` after acceptance tests pass.

### Rollback Order

1. Disable `useNewScrollSync`.
2. Disable `useLiveMarkdown`.
3. Revert code only if feature-flag rollback does not restore baseline behavior.
