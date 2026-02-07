# Focus app repagination plan

## Goals
- Focus-first UI: default single editor, minimal controls.
- Reduce visible buttons; move advanced actions to a menu or modals.
- Organize code for clarity and maintainability.
- Keep current feature set and keyboard shortcuts.

## Detailed steps
1) Update default layout: add `split-off` on initial load (body class or in `app.js` init), and ensure the split button label initializes to "Split" on desktop and "Preview/Editor" on mobile.
2) Reduce visible controls: replace the current topbar actions row with a minimal set (Title, Focus button, Menu button).
3) Add an action menu: create a menu panel in `index.html` that lists Open, Save, Split/Preview, Vim, Theme, Fonts, Shortcuts, Layout, Share; include `aria-expanded` and a clear focus order.
4) Move statusbar actions into the menu: remove the small buttons from the statusbar and keep only word/char counts.
5) Implement menu interactions in `app.js`: open/close on click, close on Escape/outside click, keep editor focus behavior, and route each menu item to existing handlers (open/save/share/modals/toggles).
6) Refine focus cues in `styles.css`: increase editor whitespace, soften panel borders, reduce topbar/status contrast, keep preview hidden by default, and make preview appear only when Split is enabled.
7) Preserve focus mode behavior: confirm focus hides topbar/status/preview and shows the hint; adjust hint text if needed to match the new control layout.
8) Organize `app.js` into clear sections: DOM refs, state, helpers, preferences (theme/fonts/layout), editor/preview sync, share, modals, menu handling, shortcuts, init; consolidate repeated modal open/close logic into shared functions.
9) Validate shortcuts with the new UI: confirm actions still work without visible buttons and that menu controls do not steal editor focus.
10) Manual QA: load page -> single view; menu shows all actions; split toggle works; focus mode entry/exit; open/save; share; theme/fonts/layout; resize to mobile; no console errors.

## Performance note
- Keep vanilla JS for speed; a framework adds runtime overhead.
- If performance becomes a concern, optimize render throttling, consider worker-based markdown parsing, or reduce highlight work.
