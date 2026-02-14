# Plan 01 - Draggable center divider for split view (Desktop-first)

## 1) Problem statement

Today layout width is controlled by:
- `Menu -> Layout`
- A modal with a slider (`#layout-modal` + `#layout-width`)
- A global content width variable (`--container-width`) that affects both editor and preview text blocks

This model is not ideal for split editing because:
- It is indirect (open menu, open modal, drag slider, close modal)
- It controls content max width, not split ratio between panes
- It does not feel like modern editor apps where center gutter drag is immediate

Target behavior for item 01:
- In split view on desktop, user drags a center divider to resize editor and preview pane widths in real time
- Divider is visible and interactive only when split view is active and viewport supports it
- Dragging is smooth, constrained, accessible, and persisted locally

## 2) Primary goals

1. Replace slider-based layout resizing with direct manipulation via center divider.
2. Keep interaction fast and intuitive (one gesture, immediate visual response).
3. Preserve existing features (focus mode, mobile toggle, shortcuts, scroll sync, share modal behavior).
4. Keep implementation maintainable by removing obsolete layout modal code paths.
5. Do not store any share tokens or sensitive data as part of this work.

## 3) Non-goals

- No backend/API changes.
- No visual redesign of markdown typography beyond what is required to support pane resizing.
- No new settings modal.
- No changes to share token handling logic (except ensuring we do not add any new persistence of tokens).
- No migration to new editor engine in this item.

## 4) Scope boundaries

In-scope files:
- `index.html`
- `styles.css`
- `app.js`

Out-of-scope files:
- `sw.js`
- `manifest.webmanifest`
- backend repo `../typim-share-api`

## 5) Constraints & Assumptions

- Static frontend only: no build pipeline, bundler, or framework migration.
- Desktop-first interaction: divider only appears on desktop viewports (`> 900px`).
- Mobile behavior unchanged: continues using toggle-based preview/editor switch.
- Split ratio persists only via `localStorage` key `splitRatio` (no sensitive data).
- Focus mode hides divider: divider must not be visible or interactive in focus mode.
- CodeMirror 5 compatibility: all editor interactions must work with current CM5 setup.
- No token persistence: must not add any storage of share edit tokens or URLs.

## 6) Current code inventory (what will change)

### 5.1 Existing layout UI and logic

In `index.html`:
- Menu item: `#menu-layout`
- Modal: `#layout-modal`
- Close button: `#layout-close`
- Slider: `#layout-width`

In `app.js`:
- DOM refs for layout modal elements
- `applyLayoutWidth(value)` sets `--container-width`
- `initLayout()` reads `layoutWidth` from localStorage
- Menu click opens layout modal
- Modal open/close flow integrated with generic modal handling
- Slider input listener writes width continuously

In `styles.css`:
- Editor and preview max width both depend on `--container-width`

### 5.2 Existing split behavior

- Desktop split mode controlled by body class `split-off`
  - `split-off` means single view
  - no `split-off` means split view
- Mobile toggles `mobile-preview`
- Existing button and shortcut route through `toggleSplit()`

This means we can hook divider visibility and logic into:
- `split-off` class state
- `isMobile()` helper

## 7) UX specification for new divider

### 7.1 Visibility

Divider should be visible only when all are true:
- desktop viewport (`!isMobile()`)
- split mode is active (`!body.classList.contains("split-off")`)
- focus mode is not active (`!body.classList.contains("focus")`)

Divider hidden otherwise.

### 7.2 Interaction model

- Hover divider shows resize cursor (`col-resize`).
- Mouse/touch pen drag starts immediately on pointer down.
- During drag:
  - ratio updates continuously
  - pane widths update live
  - text selection outside editor is suppressed to avoid accidental highlight
- Pointer up commits final ratio to state and storage.

### 7.3 Bounds

Define safe ratio constraints:
- min editor share: 30%
- max editor share: 70%
- default ratio: 50%

Reasoning:
- prevents unusable narrow panes
- keeps preview readable
- easy to reason about

### 7.4 Accessibility

Divider should support keyboard input:
- Left arrow: reduce editor share by step
- Right arrow: increase editor share by step
- Shift + Arrow: larger step
- Home: jump to min
- End: jump to max
- Enter/Space: no-op (or optional toggle), do not break focus

ARIA semantics:
- `role="separator"`
- `aria-orientation="vertical"`
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- `tabindex="0"`

### 7.5 Persistence

Persist only split ratio, for example key:
- `splitRatio` in localStorage

Never persist:
- `editToken`
- any share URL secrets beyond existing behavior

## 8) Technical design

## 8.1 HTML structure changes (`index.html`)

1. Remove layout menu entry `#menu-layout`.
2. Remove layout modal block `#layout-modal` entirely.
3. Insert divider element between panes in `.workspace`:

Suggested element:
```html
<div
  id="split-resizer"
  class="split-resizer"
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize editor and preview panes"
  aria-valuemin="30"
  aria-valuemax="70"
  aria-valuenow="50"
  tabindex="0"
></div>
```

Position in DOM:
- editor pane
- divider
- preview pane

## 8.2 CSS layout model (`styles.css`)

Introduce CSS vars:
- `--split-ratio: 0.5`
- `--split-resizer-width: 10px`
- `--split-hit-area-width: 20px` (optional pseudo-element for easier pointer hit)

Desktop split grid:
- `.workspace` in split mode becomes 3 columns:
  - `minmax(0, calc((100% - var(--split-resizer-width)) * var(--split-ratio)))`
  - `var(--split-resizer-width)`
  - `minmax(0, calc((100% - var(--split-resizer-width)) * (1 - var(--split-ratio))))`

Single view:
- keep existing behavior: preview hidden and single column

Resizer visuals:
- subtle center line
- clear hover and active state
- `cursor: col-resize`
- no heavy animation while dragging

Prevent accidental interactions:
- add `body.resizing` class while drag is active
- when `body.resizing`:
  - `user-select: none`
  - cursor forced to `col-resize`

Responsive behavior:
- on `max-width: 900px`, force resizer hidden
- keep current mobile preview toggle behavior

Focus mode:
- hide `.split-resizer` in `.focus`

## 8.3 JavaScript state model (`app.js`)

Add constants:
- `SPLIT_RATIO_KEY = "splitRatio"`
- `SPLIT_RATIO_DEFAULT = 0.5`
- `SPLIT_RATIO_MIN = 0.3`
- `SPLIT_RATIO_MAX = 0.7`
- `SPLIT_KEYBOARD_STEP = 0.02`
- `SPLIT_KEYBOARD_STEP_LARGE = 0.05`

Add runtime state:
- `let splitRatio = SPLIT_RATIO_DEFAULT`
- `let isResizing = false`
- `let activePointerId = null`

Add helpers:
- `clampRatio(value)`
- `readStoredSplitRatio()`
- `applySplitRatio(value, { persist = true } = {})`
- `isSplitResizable()` returns desktop split and not focus
- `syncResizerA11y()` updates `aria-valuenow`
- `updateResizerVisibility()`

## 8.4 Pointer event flow

On `pointerdown` on resizer:
1. verify `isSplitResizable()`
2. `isResizing = true`
3. save pointer id
4. call `setPointerCapture`
5. add `body.resizing`

On `pointermove` while active:
1. compute x relative to workspace bounds
2. ratio = `x / workspaceWidth`
3. clamp ratio to min/max
4. `applySplitRatio(ratio, { persist: false })`

On `pointerup` or `pointercancel`:
1. release capture
2. remove `body.resizing`
3. set `isResizing = false`
4. persist final ratio

Edge protection:
- if workspace width is 0, skip update
- if pointer events fire after mode switch, safely ignore

## 8.5 Keyboard interaction for separator

On keydown in resizer:
- ArrowLeft => `ratio -= step`
- ArrowRight => `ratio += step`
- Shift modifier => larger step
- Home => min
- End => max
- prevent default browser behavior for handled keys
- apply and persist

## 8.6 Integration points with existing split logic

`updateSplitButton()` and `toggleSplit()` remain source of truth for split state.

Enhancements:
- after every split state change, call `updateResizerVisibility()`
- after resize/end or split toggle, call `editor.refresh()` to avoid CM geometry drift

Window resize handling:
- existing listener already updates split label
- extend same path to also normalize divider visibility and maybe clamp ratio

## 8.7 Remove old layout feature cleanly

Delete from `app.js`:
- refs: `menuLayout`, `layoutModal`, `layoutClose`, `layoutWidth`
- functions: `applyLayoutWidth`, `initLayout`, `openLayoutModal`, `closeLayoutModal`
- listeners wired to layout controls
- modal arrays and focus checks referencing layout modal

Delete from `index.html`:
- layout menu item
- layout modal markup

Delete from `styles.css`:
- style rules only used by layout modal, if any unique selectors remain

Compatibility cleanup:
- keep existing generic modal logic but remove layout branch references

## 9) Data and storage policy

Allowed new localStorage key:
- `splitRatio`

Explicitly forbidden in this item:
- writing `shareState.editToken` to localStorage/sessionStorage/cookies
- adding tokens to query params or fragment
- logging tokens to console

Migration behavior:
- ignore previous `layoutWidth` key; optional one-time remove
- if stored `splitRatio` is invalid, fall back to default 0.5

## 10) Performance plan

Potential performance hotspots:
- frequent `pointermove` updates
- CodeMirror reflow during pane width changes

Mitigations:
1. Keep drag update lightweight:
   - update one CSS variable only
   - avoid expensive DOM reads in loop except workspace width
2. Optionally throttle with `requestAnimationFrame` if needed
3. Refresh CodeMirror only on drag end (or low-frequency during drag if visual artifacts appear)

Success target:
- drag interaction remains visually smooth on common laptop hardware

## 11) QA plan (manual)

### 10.1 Functional checks

1. Open app on desktop, split enabled:
   - divider visible in center
2. Drag divider left/right:
   - pane ratio changes live
   - cursor stays `col-resize`
3. Stop drag:
   - ratio persists after reload
4. Toggle single view:
   - divider hidden
5. Re-enable split:
   - divider returns with previous ratio
6. Enter focus mode:
   - divider hidden
7. Exit focus mode:
   - divider restored if split active

### 10.2 Responsive checks

1. Resize to mobile width (<=900px):
   - divider hidden
   - preview toggle behavior unchanged
2. Return to desktop:
   - divider shown in split mode

### 10.3 Accessibility checks

1. Tab to divider:
   - focus visible
2. Use Arrow keys:
   - pane ratio updates
   - aria value updates
3. Home/End:
   - jumps to bounds

### 10.4 Regression checks

1. Open/Save shortcuts still work
2. Share modal open/close still works
3. Theme/fonts/shortcuts modals still work
4. Scroll sync between editor and preview still works
5. No console errors during drag/toggle/resize

## 12) Risk register

Risk A: Text selection artifacts while dragging.
- Mitigation: `body.resizing { user-select: none; }`

Risk B: CodeMirror mis-measured viewport after pane width changes.
- Mitigation: call `editor.refresh()` on drag end and split toggle.

Risk C: Divider remains active in invalid states (mobile/focus/single).
- Mitigation: central `isSplitResizable()` guard and visibility sync on all state transitions.

Risk D: Accessibility regression.
- Mitigation: keyboard handler + separator ARIA attributes + focus style.

Risk E: Legacy layout code partially removed causing dead references.
- Mitigation: full grep cleanup for `layout` ids/functions and run quick smoke checks.

## 13) Rollout strategy

Single-step rollout is acceptable because:
- feature is self-contained
- no backend dependency
- fallback path exists in git history

Optional conservative path:
- keep hidden feature flag for one cycle (`enableSplitResizer` default true)
- remove flag after validation

## 14) Definition of done

Item 01 is done when all are true:
1. Slider-based layout UI is removed from menu and modal set.
2. Split divider exists and works with pointer and keyboard.
3. Divider only appears in valid contexts (desktop split, not focus).
4. Split ratio persists via localStorage key `splitRatio`.
5. No new persistence of share tokens or sensitive values.
6. Manual QA checklist passes with no major regressions.

## 15) Suggested implementation order (execution checklist)

1. HTML cleanup and divider insertion.
2. CSS grid and divider styles.
3. JS state helpers for ratio.
4. Pointer drag implementation.
5. Keyboard accessibility implementation.
6. Remove legacy layout modal logic and references.
7. Wire visibility updates into split/focus/resize flows.
8. Manual QA and bugfix pass.

## 16) Validation commands (lightweight)

Since this frontend is static and does not include a build pipeline:
- load `index.html` in browser
- run smoke checks from QA section
- optionally run a local static server if desired (for consistent behavior)

No token-saving behavior should be introduced in any validation step.

## 17) Open Questions

- Should divider snap to predefined ratios (e.g., 33/66, 50/50, 66/33) or be fully continuous?
- Should there be a reset-to-default button or keyboard shortcut for the divider?
- Should the divider be visually thicker on hover for better discoverability?
- Should we show a tooltip with current ratio percentage while dragging?
