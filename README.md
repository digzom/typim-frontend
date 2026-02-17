# Typim

A focused markdown editor with live preview.

## Features

- **Split-pane editing**: Write markdown on the left, see the preview on the right
- **Live preview**: Real-time rendering with scroll synchronization
- **Keyboard-first**: All actions accessible via keyboard shortcuts
- **Vim mode**: Full Vim keybindings support
- **Live markdown**: Auto-formatting for headings, lists, and more
- **Themes**: Light and dark modes
- **Font customization**: Choose your preferred body and monospace fonts
- **Share**: Create shareable links with optional live editing

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Development

### Project Structure

```
src/
├── core/          # State management, event bus, configuration
├── editor/        # CodeMirror 6 editor integration
├── ui/            # UI components, layout, scroll sync
├── features/      # Share, files, theme modules
├── styles/        # CSS tokens and styles
└── utils/         # Utility functions
```

### Technology Stack

- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and development server
- **CodeMirror 6**: Editor engine
- **Vitest**: Unit testing
- **Playwright**: E2E testing

### Feature Flags

Features can be enabled via URL parameters in development:

- `?cm6=true` - Enable CodeMirror 6
- `?livemd=true` - Enable live markdown
- `?scroll=true` - Enable new scroll sync
- `?tokens=true` - Enable tokenized styles

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save file |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + \\` | Toggle split view |
| `Ctrl/Cmd + Shift + F` | Focus mode |
| `Ctrl + Esc` | Exit focus mode |
| `Ctrl/Cmd + Shift + V` | Toggle Vim mode |
| `Ctrl/Cmd + Shift + D` | Toggle theme |
| `Ctrl/Cmd + Shift + L` | Toggle live markdown |
| `Ctrl + W` | Delete previous word |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

ISC
