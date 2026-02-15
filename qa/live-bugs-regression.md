# Live Bugs Regression Checklist

**Date:** 2026-02-14  
**Scope:** SC-001 through SC-006 implementation verification  
**Environment:** Desktop 1366/1920, Mobile 390  
**Plan:** ~/execution_plan_20260214_113256.yaml

---

## Bug Matrix

| ID | Scenario | Expected | Status | Notes |
| --- | --- | --- | --- | --- |
| SC-001 | Live MD ON, type `## Something` | Heading text rendered without visible `##` | Pending manual QA | Verify heading/list/quote/fence markers are masked while caret remains visible. |
| SC-002 | Editor focused, press Ctrl+W | Previous word deleted and tab remains open where browser cancellation is allowed | Pending manual QA | If browser still closes tab, fallback is Alt+Backspace. |
| SC-003 | Desktop widths at 1440px | Single 1320px, split 1100px, focus 1400px | Pending manual QA | Validate with devtools computed styles. |
| SC-004 | Wheel + typing-at-bottom in split/single/live/focus | Smooth scrolling, no sync feedback loops | Pending manual QA | Confirm editor->preview and preview->editor sync only in split desktop mode. |
| SC-005 | Cursor navigation near viewport edges | Approx 120px top/bottom breathing room except first/last lines | Pending manual QA | Validate arrow navigation and typing at file end. |
| SC-006 | Regression suite | Open/save/share/theme/fonts/vim/focus/split/mobile all still work | Pending manual QA | Confirm no console errors and no token persistence changes. |

---

## SC-001: Live Markdown Single-Pane Editing

| Test Case | Expected Result | Status | Notes |
|-----------|-----------------|--------|-------|
| Toggle Live MD ON from split mode | Switches to single pane, caret active in editor | ⬜ | |
| Toggle Live MD OFF | Restores previous split/single state | ⬜ | |
| Toggle Live MD repeatedly | No content loss, text length unchanged | ⬜ | |
| Save after Live MD edits | Markdown contains original markers | ⬜ | |
| Hide heading prefixes '#', '##' | Not visible in Live MD | ⬜ | |
| Hide list prefixes '- ', '* ', '1. ' | Not visible in Live MD | ⬜ | |
| Hide blockquote prefix '> ' | Not visible in Live MD | ⬜ | |
| Hide code fence ticks '```' | Not visible in Live MD | ⬜ | |
| Typography matches preview | Heading/body/list sizes consistent | ⬜ | |
| Caret remains visible | After theme changes, focus mode toggles | ⬜ | |

---

## SC-002: Ctrl+W Delete-Word Behavior

| Test Case | Expected Result | Status | Notes |
|-----------|-----------------|--------|-------|
| Ctrl+W in editor (Linux/Windows) | Deletes previous word, tab stays open | ⬜ | |
| Ctrl+W in title input | No interception, default behavior | ⬜ | |
| Ctrl+W in menu/modal | No editor delete-word executed | ⬜ | |
| Ctrl+W with Vim enabled | Typim interception skipped | ⬜ | |
| Alt+Backspace fallback | Works as alternative delete-word | ⬜ | |
| Shortcut help shows fallback | Text mentions "or Alt+Backspace" | ⬜ | |

---

## SC-003: Desktop Width Tokens

| Test Case | Expected Result | Status | Notes |
|-----------|-----------------|--------|-------|
| Single mode at 1440px viewport | max-width: 1320px | ⬜ | |
| Split mode at 1440px viewport | max-width: 1100px per pane | ⬜ | |
| Focus mode at 1440px viewport | max-width: 1400px | ⬜ | |
| Mobile at 390px viewport | Fluid width, no horizontal scrollbar | ⬜ | |
| Split appears wider than baseline | Compared to previous 900px limit | ⬜ | |

---

## SC-004: Scroll Synchronization

| Test Case | Expected Result | Status | Notes |
|-----------|-----------------|--------|-------|
| Wheel scroll in editor (split mode) | Preview updates without oscillation | ⬜ | |
| Wheel scroll in preview (split mode) | Editor updates without lockups | ⬜ | |
| Single mode wheel scroll | Only visible pane scrolls, no stall | ⬜ | |
| Focus mode wheel scroll | Only visible pane scrolls, no stall | ⬜ | |
| Live MD mode wheel scroll | Only visible pane scrolls, no stall | ⬜ | |
| Typing at document end | Auto-scrolls smoothly | ⬜ | |
| No console errors during scroll | Clean scroll interactions | ⬜ | |

---

## SC-005: Cursor Scrolloff

| Test Case | Expected Result | Status | Notes |
|-----------|-----------------|--------|-------|
| Arrow-down navigation | ~120px margin from bottom until last lines | ⬜ | |
| Arrow-up navigation | ~120px margin from top until first lines | ⬜ | |
| Typing at document end | Retains ~120px lower breathing room | ⬜ | |
| Boundary behavior (first line) | Margin naturally reduced | ⬜ | |
| Boundary behavior (last line) | Margin naturally reduced | ⬜ | |
| Cursor visible after scroll | No caret hidden behind padding | ⬜ | |

---

## SC-006: Core Workflows Regression

| Test Case | Expected Result | Status | Notes |
|-----------|-----------------|--------|-------|
| Open file (.md, .txt) | Content loads correctly | ⬜ | |
| Save file | Markdown content preserved | ⬜ | |
| Share modal (static/live) | Works, no token persistence issues | ⬜ | |
| Theme toggle (light/dark) | Switches correctly, caret visible | ⬜ | |
| Font selection | Body/mono fonts apply correctly | ⬜ | |
| Vim mode toggle | KeyMap switches, Ctrl+W skipped | ⬜ | |
| Focus mode toggle | Fullscreen view, exit with Ctrl+Esc | ⬜ | |
| Split toggle | Single/split switches correctly | ⬜ | |
| Mobile preview toggle | Editor/preview switches correctly | ⬜ | |
| Shortcuts modal | Opens, displays updated copy | ⬜ | |

---

## INV-006: Token Safety Verification

| Check | Expected Result | Status | Notes |
|-------|-----------------|--------|-------|
| localStorage keys inspected | Only theme/font/split/live-md preferences | ⬜ | |
| No share token key added | shareState not persisted to storage | ⬜ | |
| No credential-like values | No API keys, passwords in storage | ⬜ | |

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
- [ ] Live MD single pane: 1320px width
- [ ] Split mode: 1100px per pane
- [ ] Focus mode: 1400px width
- [ ] Ctrl+W delete-word functional
- [ ] Scroll sync in split mode

### Desktop 1366x768
- [ ] All layouts fit without overflow
- [ ] Live MD single pane: 1320px width
- [ ] Cursor scrolloff functional

### Mobile 390x844
- [ ] Fluid width, no horizontal scroll
- [ ] Mobile preview toggle works
- [ ] Touch scrolling functional
- [ ] Menu accessible

---

## Console Error Check

| Scenario | Expected | Status |
|----------|----------|--------|
| Page load | No errors | ⬜ |
| Mode toggles | No errors | ⬜ |
| Scroll interactions | No errors | ⬜ |
| Shortcut usage | No errors | ⬜ |
| File operations | No errors | ⬜ |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Reviewer | | | |

---

**Legend:**
- ⬜ = Pending / Not tested
- ✅ = Pass
- ❌ = Fail
- ⚠️ = Pass with notes
