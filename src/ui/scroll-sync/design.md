# Scroll Sync Design

## Current Behavior

- Editor and preview sync based on scroll ratio.
- Synchronization is disabled on mobile and non-split layouts.
- Source of truth switches between editor and preview based on active scroll source.

## Instability Causes

- Recursive updates when editor and preview react to each other in same frame.
- Back-to-back scroll events causing layout thrash.
- Target range mismatch when one pane has short content.

## New Model

- Use requestAnimationFrame throttling to release sync guard after paint.
- Maintain a single recursion guard (`isSyncing`) for both directions.
- Map source scroll ratio to target range using normalized `[0, 1]` ratio.

## Recursion Prevention

- Ignore sync calls while guard is active.
- Apply target scroll once per source event.
- Release guard only in next animation frame.

## Layout Rules

- Sync is disabled when viewport width is `<= 900px`.
- Sync is disabled in single, focus, and live-markdown modes.
- Sync is enabled only in split mode on desktop/tablet.

## Edge Cases

- If source range is `<= 0`, use ratio `0`.
- If target range is `<= 0`, set target scroll to `0`.
- Disable immediately cancels pending RAF callback.
