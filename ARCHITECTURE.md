# Architecture

## System Overview

Typim is built with a modular architecture using TypeScript. The application follows a unidirectional data flow with centralized state management.

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Menu   │  │ Modals  │  │ Editor  │  │ Preview │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    Core Infrastructure                       │
│  ┌──────────────┐  ┌─────┴─────┐  ┌──────────────┐         │
│  │  EventBus    │  │  State    │  │  Storage     │         │
│  │  (pub/sub)   │  │  Manager  │  │  Adapter     │         │
│  └──────────────┘  └───────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼────────┐  ┌─────▼──────┐
│   Editor     │  │   Features      │  │   UI/UX    │
│   Engine     │  │                 │  │            │
│  ┌────────┐  │  │  ┌──────────┐   │  │ ┌────────┐ │
│  │  CM6   │  │  │  │  Share   │   │  │ │ Layout │ │
│  │  CM5   │  │  │  └──────────┘   │  │ │ Mgr    │ │
│  └────────┘  │  │  ┌──────────┐   │  │ └────────┘ │
│              │  │  │  Files   │   │  │            │
│  ┌────────┐  │  │  └──────────┘   │  │ ┌────────┐ │
│  │ Live   │  │  │  ┌──────────┐   │  │ │ Scroll │ │
│  │ Markdown  │  │  │  Theme   │   │  │ │ Sync   │ │
│  └────────┘  │  │  └──────────┘   │  │ └────────┘ │
└──────────────┘  └─────────────────┘  └────────────┘
```

## Module Descriptions

### Core Infrastructure

#### EventBus
- Centralized event communication
- Typed events for type safety
- Supports subscription, unsubscription, and one-time events

#### StateManager
- Redux-like state management with reducer pattern
- Immutable state updates
- Persistence to localStorage (with security constraints)
- Subscriptions for state changes

#### StorageAdapter
- Safe wrapper around localStorage
- Schema versioning
- **Security**: Blocks storage of sensitive data (edit tokens)

### Editor Module

#### CM6EditorEngine
- CodeMirror 6 integration
- Markdown language support
- Vim mode via @replit/codemirror-vim
- Theme integration

#### LiveMarkdownEngine
- Deterministic input/exit rules
- Context-aware transformations
- Performance optimized (< 16ms per operation)

### UI Module

#### LayoutManager
- Mode switching (split, single, focus, mobile)
- Split ratio management
- Responsive behavior

#### ScrollCoordinator
- Bidirectional scroll sync
- RAF throttling
- Recursion guards
- Disabled in mobile/single/focus modes

### Feature Modules

#### ShareModule
- Share API client
- Edit token management (in-memory only)
- Static and live share types

#### FileModule
- File open/save operations
- Markdown file filtering

#### ThemeManager
- Light/dark theme switching
- CSS variable application
- Persistence

## Data Flow

```
User Action → EventBus → StateManager → UI Updates
                  ↓
            Persistence
            (StorageAdapter)
```

1. User interaction triggers event
2. EventBus routes event to handlers
3. StateManager updates state via reducer
4. Subscribers receive new state
5. UI components re-render
6. Changes persisted to storage

## Security Considerations

### INV-002: No Share Token Persistence
Share edit tokens are never stored in localStorage. They are kept in memory only and lost on page reload. This prevents unauthorized access to shared documents if the user's device is compromised.

### Input Validation
- Storage keys use an allowlist approach
- File operations validate markdown file types
- Share API validates request payloads

## Performance

### INV-007: Performance Budgets
- Typing latency: < 16ms per keystroke
- Document load: < 1s for 10k words
- Scroll: 60fps target
- Memory: < 100MB typical usage

### Optimization Strategies
- RAF throttling for scroll sync
- Debounced persistence
- Structural sharing in state updates
- Lazy loading for optional features

## Architecture Decision Records

See `docs/adr/` for individual ADRs:

- ADR-001: Project Modularization
- ADR-002: CodeMirror 6 Migration
- ADR-003: Live Markdown Redesign
- ADR-004: Scroll/Scrollbar Redesign
- ADR-005: Typography System
- ADR-006: State Architecture
- ADR-007: Tooling and Quality Gates
- ADR-008: Documentation Strategy
- ADR-009: Migration Strategy

## Invariants

The following invariants are enforced throughout the codebase:

1. **INV-001**: Save produces valid markdown
2. **INV-002**: Share tokens never persisted
3. **INV-003**: Keyboard-first workflow preserved
4. **INV-004**: No mobile horizontal overflow
5. **INV-005**: Accessibility compliance
6. **INV-006**: Share API contract unchanged
7. **INV-007**: Performance budgets enforced
8. **INV-008**: Quality gates mandatory

## Feature Flags

Major features are behind feature flags for gradual rollout:

| Flag | Description | Default |
|------|-------------|---------|
| useCM6 | CodeMirror 6 engine | false |
| useLiveMarkdown | Live markdown formatting | false |
| useNewScrollSync | New scroll sync implementation | false |
| useTokenizedStyles | CSS token system | false |

## Testing Strategy

### Unit Tests
- Core modules (StateManager, EventBus, StorageAdapter)
- Utility functions
- Feature modules

### Integration Tests
- State + Storage interaction
- Editor + Live Markdown
- Scroll Coordinator + Editor

### E2E Tests
- Complete user workflows
- All invariant scenarios
- Cross-browser testing
