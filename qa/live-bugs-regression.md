# Live Bugs Regression Checklist

Environment:
- Date: 2026-02-14
- App: typim-frontend
- Plan: ~/execution_plan_20260214_113256.yaml

## Bug Matrix

| ID | Scenario | Expected | Status | Notes |
| --- | --- | --- | --- | --- |
| SC-001 | Live MD ON, type `## Something` | Heading text rendered without visible `##` | Pending manual QA | Verify heading/list/quote/fence markers are masked while caret remains visible. |
| SC-002 | Editor focused, press Ctrl+W | Previous word deleted and tab remains open where browser cancellation is allowed | Pending manual QA | If browser still closes tab, fallback is Alt+Backspace. |
| SC-003 | Desktop widths at 1440px | Single 1320px, split 1100px, focus 1400px | Pending manual QA | Validate with devtools computed styles. |
| SC-004 | Wheel + typing-at-bottom in split/single/live/focus | Smooth scrolling, no sync feedback loops | Pending manual QA | Confirm editor->preview and preview->editor sync only in split desktop mode. |
| SC-005 | Cursor navigation near viewport edges | Approx 120px top/bottom breathing room except first/last lines | Pending manual QA | Validate arrow navigation and typing at file end. |
| SC-006 | Regression suite | Open/save/share/theme/fonts/vim/focus/split/mobile all still work | Pending manual QA | Confirm no console errors and no token persistence changes. |

## Storage Safety Check

Expected localStorage keys touched by this scope:
- `theme`
- `fontBody`
- `fontMono`
- `splitRatio`
- `enableLiveMarkdown`

Forbidden keys:
- Any key storing share edit tokens
- Any key storing share URLs as credentials
