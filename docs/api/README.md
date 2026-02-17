# API Contracts

This directory contains versioned runtime contract records for remediation hardening.

## Contracts

- `state-manager-dispatch-v2.md`: `StateManager.dispatch` structured result contract and invalid action rejection.
- `event-bus-envelope-v2.md`: `EventBus.emit` envelope contract with source propagation and `subscribeAll` parity.

## Compatibility Policy

- Contract tags follow semver-style version suffixes.
- This remediation introduces additive compatibility adapters only.
- Existing call sites that read state slices from `dispatch` return values remain functional.
