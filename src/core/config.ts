/**
 * Configuration constants and feature flags
 * @module core/config
 */

import type { AppConfig, Environment } from './types';

/** Detect current environment */
const detectEnvironment = (): Environment => {
  if (typeof window === 'undefined') return 'production';
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'development'
    : 'production';
};

interface FeatureFlagOverrides {
  useCM6?: boolean;
  useLiveMarkdown?: boolean;
  useFenceHighlighting?: boolean;
  useNewScrollSync?: boolean;
  useTokenizedStyles?: boolean;
}

/** Parse feature flags from URL parameters (dev only) */
const parseFeatureFlags = (): FeatureFlagOverrides => {
  const flags: FeatureFlagOverrides = {};

  if (typeof window === 'undefined') return flags;

  const env = detectEnvironment();
  const params = new URLSearchParams(window.location.search);

  // Only allow URL overrides in development
  if (env === 'development') {
    const cm6Value = params.get('cm6');
    if (cm6Value !== null) flags.useCM6 = cm6Value === 'true';
    const livemdValue = params.get('livemd');
    if (livemdValue !== null) flags.useLiveMarkdown = livemdValue === 'true';
    const fenceValue = params.get('fence');
    if (fenceValue !== null) flags.useFenceHighlighting = fenceValue === 'true';
    const scrollValue = params.get('scroll');
    if (scrollValue !== null) flags.useNewScrollSync = scrollValue === 'true';
    const tokensValue = params.get('tokens');
    if (tokensValue !== null) flags.useTokenizedStyles = tokensValue === 'true';
  }

  return flags;
};

const urlFlags = parseFeatureFlags();
const isDevelopment = detectEnvironment() === 'development';

/**
 * Application configuration
 * Safe defaults with feature flags initially disabled
 */
export const CONFIG: AppConfig = {
  environment: detectEnvironment(),
  version: '2.0.0',
  storageVersion: 1,

  features: {
    // Prefer CM6 in development to avoid CM5 CDN dependency stalls.
    // URL params can still force cm6=false for fallback testing.
    useCM6: urlFlags.useCM6 ?? isDevelopment,
    // Keep Live Markdown available in development for local testing.
    useLiveMarkdown: urlFlags.useLiveMarkdown ?? isDevelopment,
    // Roll out fenced language highlighting independently from live markdown.
    useFenceHighlighting: urlFlags.useFenceHighlighting ?? false,
    // Enable mapping-first split scroll sync in development by default.
    useNewScrollSync: urlFlags.useNewScrollSync ?? isDevelopment,
    useTokenizedStyles: urlFlags.useTokenizedStyles ?? false,
  },

  api: {
    baseUrl: 'https://api.typim.io/v1',
    timeout: 10000,
  },
};

/**
 * Check if a feature is enabled
 * @param feature - Feature flag name
 * @returns True if feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof CONFIG.features): boolean {
  return CONFIG.features[feature];
}

/**
 * Enable a feature flag at runtime
 * Note: Some features require reload to take effect
 * @param feature - Feature flag name
 * @param enabled - Whether to enable or disable
 */
export function setFeatureFlag(feature: keyof typeof CONFIG.features, enabled: boolean): void {
  CONFIG.features[feature] = enabled;
}

/**
 * Editor-specific constants
 */
export const EDITOR_CONSTANTS = {
  /** Starter document content */
  STARTER_CONTENT: `# Typim

Welcome to a focused markdown space.

## Quick start
- Write markdown on the left
- Preview updates instantly on the right
- Save with Ctrl+S or Cmd+S

> Tip: Use **bold**, _italic_, and inline code with single backticks.

### Task list
- [x] Clean layout
- [ ] Your next idea

### Dev joke
Why do programmers prefer dark mode?

Because light attracts bugs! 🐛

\`\`\`js
function hello() {
  return "Hello";
}
\`\`\`
`,

  /** Default document title */
  DEFAULT_TITLE: 'Untitled',

  /** Split ratio constraints */
  SPLIT: {
    DEFAULT: 0.5,
    MIN: 0.3,
    MAX: 0.7,
    KEYBOARD_STEP: 0.02,
    KEYBOARD_STEP_LARGE: 0.05,
  },

  /** Mobile breakpoint */
  MOBILE_BREAKPOINT: 900,

  /** Performance thresholds */
  PERFORMANCE: {
    MAX_TYPING_LATENCY: 16, // ms
    MAX_DOCUMENT_LOAD_TIME: 1000, // ms for 10k words
    TARGET_SCROLL_FPS: 60,
  },
};

/**
 * Storage keys
 * IMPORTANT: Edit tokens are NEVER stored (INV-002)
 */
export const STORAGE_KEYS = {
  /** Application state (excluding sensitive data) */
  STATE: 'typim:state',

  /** Font preferences */
  FONTS: 'typim:fonts',

  /** Theme preference */
  THEME: 'typim:theme',

  /** Split ratio */
  SPLIT_RATIO: 'typim:splitRatio',

  /** Live markdown preference */
  LIVE_MD: 'typim:enableLiveMarkdown',

  /** Vim mode preference */
  VIM_MODE: 'typim:vimMode',
} as const;

/**
 * Font family definitions
 */
export const FONT_FAMILIES = {
  body: {
    serif: '"Source Serif 4", "Iowan Old Style", "Georgia", serif',
    sans: '"Source Sans 3", "Noto Sans", "Helvetica Neue", sans-serif',
  },
  mono: {
    plex: '"Source Code Pro", "IBM Plex Mono", "Menlo", "Consolas", monospace',
    system: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
};

/**
 * Share configuration
 */
export const SHARE_CONFIG = {
  /** Share link expiration in hours */
  EXPIRATION_HOURS: 4,

  /** Valid share types */
  VALID_TYPES: ['static', 'live'] as const,

  /** Valid privacy settings */
  VALID_PRIVACY: ['secret', 'public'] as const,
};
