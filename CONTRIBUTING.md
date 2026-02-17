# Contributing to Typim

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/digzom/typim-frontend.git
   cd typim-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── core/          # EventBus, StateManager, config, errors, types
├── editor/        # CodeMirror 6 setup and extensions
├── ui/            # Components, layout, scroll sync
├── features/      # Share, files, theme
├── styles/        # CSS tokens and stylesheets
└── utils/         # DOM utilities, storage, markdown
```

## Coding Standards

### TypeScript
- Use strict TypeScript mode
- Explicit return types on exported functions
- No `any` types (use `unknown` with type guards)
- Prefer `readonly` for immutable properties

### State Management
- All state changes go through StateManager
- Actions are plain objects with `type` and `payload`
- State updates must be immutable
- Selectors should be pure functions

### Testing
- Unit tests for all core modules
- Integration tests for feature workflows
- E2E tests for critical paths
- Target: 80% code coverage

### CSS
- Use CSS custom properties (tokens)
- Follow BEM naming convention
- Mobile-first responsive design
- Dark mode support required

## Pull Request Process

1. **Before submitting**
   - Run all tests: `npm test`
   - Run linter: `npm run lint`
   - Run type check: `npm run typecheck`
   - Update documentation if needed

2. **PR requirements**
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes
   - Test coverage for new code

3. **Review process**
   - All PRs require review
   - CI checks must pass
   - No merge conflicts

## Feature Development

### Adding a New Feature

1. Create feature flag in `src/core/config.ts`
2. Implement feature behind flag
3. Add unit tests
4. Add E2E tests
5. Update documentation

### Adding a New State Action

1. Add action type to `StateAction` union in `src/core/types.ts`
2. Add handler to reducer in `src/core/state.ts`
3. Add tests for the action

### Adding a New Event

1. Add event name to `AppEvent` type in `src/core/types.ts`
2. Document event payload structure
3. Emit event from source module

## Code Review Guidelines

### Reviewer Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] No security vulnerabilities introduced
- [ ] Performance impact considered
- [ ] Documentation updated

### Invariant Verification
Changes that affect invariants require explicit verification:

- **INV-001**: Verify save produces valid markdown
- **INV-002**: Verify no sensitive data persisted
- **INV-003**: Verify keyboard shortcuts work
- **INV-004**: Verify mobile behavior
- **INV-005**: Verify accessibility
- **INV-006**: Verify API contracts
- **INV-007**: Verify performance budgets
- **INV-008**: Verify quality gates

## Debugging

### Development Tools
- TypeScript strict mode catches many errors
- Vitest watch mode for test-driven development
- Vite HMR for fast feedback
- Browser DevTools for runtime debugging

### Common Issues

**Module not found**
- Check path aliases in `vite.config.ts`
- Ensure file is included in `tsconfig.json`

**Test failures**
- Run `npm run test:unit -- --reporter=verbose`
- Check for state pollution between tests
- Verify localStorage mock is reset

**Build errors**
- Run `npm run typecheck` for TypeScript errors
- Check for circular dependencies
- Verify all imports resolve

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run full test suite
4. Create release PR
5. Tag release after merge
6. Deploy from CI

## Questions?

Open an issue for:
- Bug reports
- Feature requests
- Documentation improvements
- General questions

## License

By contributing, you agree that your contributions will be licensed under the ISC License.
