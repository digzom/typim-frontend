# Changelog

## Unreleased

### Added

- StateManager dispatch V2 contract tests and runtime validation for invalid actions/payloads.
- EventBus envelope V2 contract tests for source propagation and `subscribeAll` parity.
- Mobile layout contract e2e coverage for canonical `data-layout` and `data-mobile-pane` mapping.
- Style split artifacts under `src/styles/editor`, `src/styles/preview`, and `src/styles/ui`.
- API contract documentation under `docs/api/`.
- Semantic markdown delimiter visibility extension with cursor-aware hide/reveal classes.
- Viewport-context scrolloff policy extension with boundary clamp behavior.
- Preview source-position anchor map generation from markdown-it token maps.
- Command registry for menu/shortcut parity and shared shortcut hint rendering.
- Unit/integration/e2e coverage for source-map scroll sync fallback paths and Ctrl/Cmd+W guards.

### Changed

- Ctrl+W parity now uses explicit guards for editor focus, modal state, and Vim mode.
- Layout manager applies canonical mobile attributes and keeps compatibility selectors during migration.
- EventBus emits canonical envelopes with source and timestamp.
- ADR-001 through ADR-009 now contain concrete, auditable decision records.
- Scroll sync now resolves from source-position anchors first and uses ratio math as explicit fallback mode.
- Shortcut help now opens with both Ctrl/Cmd+/ and F1 via the command registry path.
- App shell now keeps topbar sticky with page scroll ownership locked to editor/preview panes.

### Fixed

- Idempotent state dispatch no longer emits duplicate `state:changed` events.
- Mobile pane switching now stays synchronized between TypeScript state and CSS selectors.
- Save/export remains source-faithful markdown while semantic delimiter rendering is active.
