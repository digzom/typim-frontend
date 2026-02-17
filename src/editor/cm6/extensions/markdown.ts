import { markdown } from '@codemirror/lang-markdown';
import type { Extension } from '@codemirror/state';
import type { Cm6FenceLanguageRegistryV1 } from './fence-language-registry';
import {
  getMarkdownRenderer as getSharedMarkdownRenderer,
  renderMarkdownToHtml as renderSharedMarkdownToHtml,
  renderMarkdownWithSourceMap as renderSharedMarkdownWithSourceMap,
} from '../../../utils/markdown';

export interface MarkdownExtensionOptions {
  enableFenceHighlighting?: boolean;
  registry?: Cm6FenceLanguageRegistryV1;
}

export function createMarkdownExtension(options: MarkdownExtensionOptions = {}): Extension {
  const registry = options.registry;
  if (!options.enableFenceHighlighting || !registry) {
    return markdown();
  }

  return markdown({
    codeLanguages: info => registry.resolveCodeLanguage(info),
  });
}

export function renderMarkdownToHtml(source: string): string {
  return renderSharedMarkdownToHtml(source);
}

export function renderMarkdownWithSourceMap(source: string) {
  return renderSharedMarkdownWithSourceMap(source);
}

export function getMarkdownRenderer() {
  return getSharedMarkdownRenderer();
}
