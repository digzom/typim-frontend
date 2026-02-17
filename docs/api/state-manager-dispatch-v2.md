# StateManager Dispatch Contract V2

## Signature

`dispatch(action: unknown): DispatchResultCompat`

## Input

- `action`: unknown value validated at runtime.

## Output

- `ok`: boolean success flag.
- `state`: current `AppState` snapshot after validation/reducer execution.
- `prevState`: previous `AppState` snapshot.
- `changed`: boolean indicating whether reducer produced a transition.
- `error`: optional `{ code, message }` with `INVALID_ACTION` or `INVALID_PAYLOAD`.
- Compatibility adapter fields: top-level `editor`, `ui`, `fonts`, and `share` mirror `state`.

## Determinism Rules

- Invalid actions never mutate state.
- Idempotent updates return `changed=false` and do not emit duplicate `state:changed` events.
- State transitions emit `state:changed` with source `StateManager.dispatch`.

## Backward Compatibility

- Existing action unions remain the source of truth.
- Existing consumers reading `dispatch(...).ui` or other state slices continue to work.

## Verification

- `tests/unit/core/state.test.ts`
- `npx vitest run tests/unit/core/state.test.ts`
