# Plan 02 - Default content width

## GOAL

Increase the default reading and writing width so editor and preview are clearly wider on desktop, while preserving comfortable readability and no regression on mobile.

## SCOPE (in / out)

In scope:
- Frontend only: `index.html`, `styles.css`, `app.js`
- Default width behavior for editor and preview containers
- Cleanup of legacy slider-width state after moving to divider-based split control

Out of scope:
- Backend changes (`../typim-share-api`)
- Share API behavior
- Token or auth storage model

## CONSTRAINTS & ASSUMPTIONS

- The app is static (no build pipeline), so changes must work with current HTML/CSS/JS loading.
- Width changes must be consistent in split and single view.
- Mobile behavior (`<= 900px`) must stay practical and legible.
- No sensitive values (including share edit tokens) will be added to storage in this work.
- If item 01 is implemented first, this plan must not fight split ratio behavior.

## STEPS

1. Baseline audit
   - Identify all width constraints currently controlling editor and preview (`max-width`, padding, CSS vars).
   - Deliverable: list of width-controlling selectors and variables.

2. Define a new width system
   - Introduce clear CSS variables for content width in single and split contexts (for example `--content-max-single`, `--content-max-split`).
   - Make defaults significantly larger than current values.
   - Deliverable: documented variable map in `styles.css`.

3. Apply larger defaults
   - Update `.editor-pane .CodeMirror` and `.preview` to use the new variables.
   - Keep left/right padding balanced so lines do not feel cramped to pane edges.
   - Deliverable: updated desktop widths with visibly wider content.

4. Remove slider dependency
   - Remove any remaining dependency on `layoutWidth` and `--container-width` if legacy paths still exist.
   - Keep behavior deterministic with CSS defaults plus split divider ratio from item 01.
   - Deliverable: no active runtime path depends on width slider state.

5. Responsive tuning
   - Tune `@media (max-width: 900px)` and `@media (max-width: 600px)` so mobile spacing remains readable.
   - Ensure width constraints do not create horizontal scroll.
   - Deliverable: mobile rules validated for editor and preview.

6. Regression check for view modes
   - Verify single view, split view, and focus mode all remain coherent.
   - Deliverable: width behavior matrix across modes.

## RISKS

- Risk: lines become too long and reduce readability.
  - Mitigation: set larger but bounded max widths instead of unlimited width.

- Risk: split mode plus wider defaults causes cramped preview on smaller desktops.
  - Mitigation: separate defaults for single vs split contexts and clamp where needed.

- Risk: leftover legacy width state causes inconsistent startup behavior.
  - Mitigation: remove or ignore old `layoutWidth` state and use strict fallback defaults.

## QA / ACCEPTANCE CRITERIA

- AC-01: On desktop single view, content area is visibly wider than current baseline.
- AC-02: On desktop split view, both panes remain usable and clearly wider than before.
- AC-03: On mobile widths, no horizontal overflow is introduced by default width changes.
- AC-04: Focus mode still renders editor comfortably and without layout glitches.
- AC-05: No token persistence behavior is added or altered.
- AC-06: No console errors from removed legacy width paths.

Manual QA matrix:
- Desktop (1366 and 1920): single, split, focus
- Tablet-like width (~900): split/mobile transition
- Phone width (~390): editor mode and preview mode

## OPEN QUESTIONS

- Should single view target a very wide writing canvas (high density) or a moderate reading-first width?
- Should split mode use symmetric defaults (50/50 visual balance) or slight editor bias (for example 55/45)?
