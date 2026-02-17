# EventBus Envelope Contract V2

## Signature

- `emit(event: AppEvent, payload?: unknown, source?: string): EventEmitResult`
- `subscribeAll(callback: (envelope: EventEnvelope) => void): () => void`

## Envelope

Each emission uses a canonical envelope:

```ts
{
  event: AppEvent;
  payload?: unknown;
  source: string; // defaults to 'unknown'
  timestamp: number;
}
```

## Delivery Rules

- Event-specific subscribers and `subscribeAll` receive envelope data from the same emission path.
- Subscriber exceptions are isolated; remaining subscribers still execute.
- `emit(event, payload)` remains valid and assigns `source='unknown'`.

## Return Value

- `delivered`: number of event-specific handlers executed successfully.
- `envelope`: emitted canonical envelope.

## Verification

- `tests/unit/core/event-bus.test.ts`
- `npx vitest run tests/unit/core/event-bus.test.ts`
