# Plan 04 - Ctrl+W deletes word

## GOAL

Rebind `Ctrl+W` so it deletes the previous word in the editor instead of closing the browser tab, matching common terminal/editor conventions.

## SCOPE (in / out)

In scope:
- Frontend only: `app.js` (key handling), `index.html` (shortcuts documentation)
- Global key capture for `Ctrl+W` when editor has focus
- Word deletion command implementation
- Respect for Vim mode and other keymaps

Out of scope:
- Backend changes
- Token or auth modifications
- Changing `Cmd+W` on Mac (browser convention differs; can add later if requested)
- Changes to other shortcuts

## CONSTRAINTS & ASSUMPTIONS

- Must not break existing shortcuts (`Ctrl+S`, `Ctrl+O`, etc.).
- Must handle focus correctly: only active when editor focused and no modal open.
- Vim mode has its own word deletion; must not conflict.
- Browser may prevent `Ctrl+W` interception on some platforms; we will attempt best-effort with `preventDefault`.
- No sensitive data persistence changes.

## STEPS

1. Implement delete-word-before command
   - Function: `deleteWordBefore()` finds word boundary before cursor and removes it.
   - Word boundaries: whitespace, punctuation vs alphanumeric transitions.
   - If cursor at line start, join with previous line (optional behavior to decide).

2. Add CodeMirror key binding
   - Bind `Ctrl-W` in default keymap to `deleteWordBefore`.
   - Ensure it does not shadow other `W` bindings accidentally.

3. Add global capture for Ctrl+W
   - Listener on `window` or `document` in capture phase.
   - Check conditions before intercepting:
     - Editor has focus (check activeElement within CodeMirror wrapper).
     - No modal is currently open (share, font, shortcuts, etc.).
     - Not in an input field outside editor.
   - Call `preventDefault()` and execute deletion when conditions met.
   - Pass through to browser if conditions not met (allow tab close when appropriate).

4. Handle Vim mode specially
   - Vim mode has its own `Ctrl-W` window management or word handling.
   - Detect Vim keymap active; do not add conflicting global listener in that case.
   - Document behavior: in Vim mode, use Vim's native word deletion (`db` or similar).

5. Handle modal and focus edge cases
   - If share modal is open and has text inputs, `Ctrl+W` in those inputs should not close tab.
   - Same for font modal inputs.
   - Generally: only intercept when editor canvas focused.

6. Update documentation
   - Add `Ctrl+W` entry to shortcuts modal table.
   - Update shortcuts list in `index.html` if present.

7. Cross-browser testing
   - Verify on Chrome/Firefox/Edge (Linux/Windows).
   - Check if any browser prevents the interception entirely.
   - Document fallback: if interception fails, user can still use `Alt+Backspace` for similar effect.

## RISKS

- Risk: Browser security policy prevents `Ctrl+W` interception.
  - Mitigation: graceful degradation; document `Alt+Backspace` alternative.

- Risk: Vim users experience broken window management.
  - Mitigation: skip global capture when Vim keymap is active; let Vim handle it.

- Risk: User accidentally loses work by expecting tab close but getting word delete.
  - Mitigation: only intercept when editor explicitly focused; clicking outside editor allows normal tab close.

- Risk: Other keymaps or addons conflict.
  - Mitigation: use `extraKeys` priority in CodeMirror; allow users to disable via feature flag if needed.

- Risk: Modal input fields accidentally trigger word delete when user wants tab close.
  - Mitigation: strict focus check; exclude all non-editor inputs from interception.

## QA / ACCEPTANCE CRITERIA

- AC-01: With cursor in editor, pressing `Ctrl+W` deletes previous word and does not close tab.
- AC-02: With focus in share modal URL input, `Ctrl+W` does not delete word (allows normal tab close or input handling).
- AC-03: With Vim mode enabled, `Ctrl+W` does not conflict unexpectedly (either disabled or mapped to Vim behavior).
- AC-04: Other shortcuts (`Ctrl+S`, `Ctrl+O`, etc.) continue working normally.
- AC-05: Shortcuts modal lists `Ctrl+W` with description "Delete previous word".
- AC-06: No console errors from key handling code.
- AC-07: No token persistence behavior is added or modified.

Test matrix:
- Linux Chrome: editor focus, modal focus, page background focus
- Firefox: same scenarios
- Edge: same scenarios
- With Vim mode on: verify no broken behavior

## OPEN QUESTIONS

- Should Mac `Cmd+W` also be intercepted, or should we follow Mac convention where Cmd+W closes window?
- Should there be a setting to disable this behavior entirely?
- Should word deletion work across line breaks (join lines) or stop at line start?
