import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';

export type FenceLanguageId =
  | 'java'
  | 'javascript'
  | 'typescript'
  | 'elixir'
  | 'go'
  | 'ruby'
  | 'python'
  | 'php';

export type FenceLoadState = 'eager' | 'lazy' | 'fallback';

export interface FenceLanguageResolution {
  languageId: FenceLanguageId | null;
  aliasMatched: string | null;
  support: LanguageSupport | null;
  loadState: FenceLoadState;
}

export interface Cm6FenceLanguageRegistryV1 {
  resolveFenceLanguage(input: {
    fenceName: string | null | undefined;
  }): Promise<FenceLanguageResolution>;
  resolveCodeLanguage(fenceName: string | null | undefined): LanguageDescription | null;
  getCodeLanguageDescriptions(): readonly LanguageDescription[];
}

type FenceLanguageLoader = () => Promise<LanguageSupport>;

interface FenceLanguageRegistryOptions {
  loaders?: Partial<Record<FenceLanguageId, FenceLanguageLoader>>;
}

const CURATED_LANGUAGE_IDS: readonly FenceLanguageId[] = [
  'java',
  'javascript',
  'typescript',
  'elixir',
  'go',
  'ruby',
  'python',
  'php',
];

const FENCE_ALIAS_TO_ID: Readonly<Record<string, FenceLanguageId>> = {
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  elixir: 'elixir',
  go: 'go',
  golang: 'go',
  ruby: 'ruby',
  python: 'python',
  py: 'python',
  php: 'php',
};

function normalizeFenceName(fenceName: string | null | undefined): string | null {
  if (!fenceName) {
    return null;
  }

  const normalizedToken = fenceName.trim().split(/\s+/u)[0]?.toLowerCase() ?? '';
  return normalizedToken.length > 0 ? normalizedToken : null;
}

function aliasesForLanguage(languageId: FenceLanguageId): string[] {
  const aliases: string[] = [];

  for (const [alias, id] of Object.entries(FENCE_ALIAS_TO_ID)) {
    if (id === languageId && alias !== languageId) {
      aliases.push(alias);
    }
  }

  return aliases;
}

const DEFAULT_LOADERS: Record<FenceLanguageId, FenceLanguageLoader> = {
  java: async () => {
    const module = await import('@codemirror/lang-java');
    return module.java();
  },
  javascript: async () => {
    const module = await import('@codemirror/lang-javascript');
    return module.javascript();
  },
  typescript: async () => {
    const module = await import('@codemirror/lang-javascript');
    return module.javascript({ typescript: true });
  },
  elixir: async () => {
    const module = await import('codemirror-lang-elixir');
    return module.elixir();
  },
  go: async () => {
    const module = await import('@codemirror/lang-go');
    return module.go();
  },
  ruby: async () => {
    const module = await import('@codemirror/legacy-modes/mode/ruby');
    return new LanguageSupport(StreamLanguage.define(module.ruby));
  },
  python: async () => {
    const module = await import('@codemirror/lang-python');
    return module.python();
  },
  php: async () => {
    const module = await import('@codemirror/lang-php');
    return module.php();
  },
};

const PLAIN_TEXT_FALLBACK_SUPPORT = new LanguageSupport(
  StreamLanguage.define({
    token(stream) {
      stream.skipToEnd();
      return null;
    },
  })
);

class FenceLanguageRegistry implements Cm6FenceLanguageRegistryV1 {
  private readonly loaders: Record<FenceLanguageId, FenceLanguageLoader>;

  private readonly descriptions: Record<FenceLanguageId, LanguageDescription>;

  private readonly supportCache = new Map<FenceLanguageId, LanguageSupport>();

  private readonly failedLanguages = new Set<FenceLanguageId>();

  private readonly inFlightLoads = new Map<FenceLanguageId, Promise<LanguageSupport | null>>();

  constructor(options?: FenceLanguageRegistryOptions) {
    this.loaders = {
      ...DEFAULT_LOADERS,
      ...options?.loaders,
    };

    this.descriptions = {
      java: this.createDescription('java'),
      javascript: this.createDescription('javascript'),
      typescript: this.createDescription('typescript'),
      elixir: this.createDescription('elixir'),
      go: this.createDescription('go'),
      ruby: this.createDescription('ruby'),
      python: this.createDescription('python'),
      php: this.createDescription('php'),
    };
  }

  async resolveFenceLanguage(input: {
    fenceName: string | null | undefined;
  }): Promise<FenceLanguageResolution> {
    const normalizedFence = normalizeFenceName(input.fenceName);
    const languageId = normalizedFence ? (FENCE_ALIAS_TO_ID[normalizedFence] ?? null) : null;

    if (!languageId || !normalizedFence) {
      return {
        languageId: null,
        aliasMatched: null,
        support: null,
        loadState: 'fallback',
      };
    }

    const cachedSupport = this.supportCache.get(languageId);
    if (cachedSupport) {
      return {
        languageId,
        aliasMatched: normalizedFence,
        support: cachedSupport,
        loadState: 'eager',
      };
    }

    const support = await this.loadLanguage(languageId);
    if (!support) {
      return {
        languageId,
        aliasMatched: normalizedFence,
        support: null,
        loadState: 'fallback',
      };
    }

    return {
      languageId,
      aliasMatched: normalizedFence,
      support,
      loadState: 'lazy',
    };
  }

  resolveCodeLanguage(fenceName: string | null | undefined): LanguageDescription | null {
    const normalizedFence = normalizeFenceName(fenceName);
    if (!normalizedFence) {
      return null;
    }

    const languageId = FENCE_ALIAS_TO_ID[normalizedFence];
    if (!languageId) {
      return null;
    }

    return this.descriptions[languageId];
  }

  getCodeLanguageDescriptions(): readonly LanguageDescription[] {
    return CURATED_LANGUAGE_IDS.map(languageId => this.descriptions[languageId]);
  }

  private createDescription(languageId: FenceLanguageId): LanguageDescription {
    return LanguageDescription.of({
      name: languageId,
      alias: aliasesForLanguage(languageId),
      load: async () => {
        const support = await this.loadLanguage(languageId);
        return support ?? PLAIN_TEXT_FALLBACK_SUPPORT;
      },
    });
  }

  private async loadLanguage(languageId: FenceLanguageId): Promise<LanguageSupport | null> {
    const cachedSupport = this.supportCache.get(languageId);
    if (cachedSupport) {
      return cachedSupport;
    }

    if (this.failedLanguages.has(languageId)) {
      return null;
    }

    const inFlightLoad = this.inFlightLoads.get(languageId);
    if (inFlightLoad) {
      return inFlightLoad;
    }

    const loadPromise = this.loaders[languageId]()
      .then(support => {
        this.supportCache.set(languageId, support);
        return support;
      })
      .catch(() => {
        this.failedLanguages.add(languageId);
        return null;
      })
      .finally(() => {
        this.inFlightLoads.delete(languageId);
      });

    this.inFlightLoads.set(languageId, loadPromise);
    return loadPromise;
  }
}

export function createCm6FenceLanguageRegistry(
  options?: FenceLanguageRegistryOptions
): Cm6FenceLanguageRegistryV1 {
  return new FenceLanguageRegistry(options);
}

export const cm6FenceLanguageRegistry = createCm6FenceLanguageRegistry();
