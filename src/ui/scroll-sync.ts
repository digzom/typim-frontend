import type {
  IEditorEngine,
  IScrollCoordinator,
  PreviewSourceMap,
  ScrollSyncInput,
  ScrollSyncOutput,
} from '../core/types';
import type { EditorView } from '@codemirror/view';

interface ScrollCoordinatorOptions {
  isSyncAllowed?: () => boolean;
  getSourceMap?: () => PreviewSourceMap | null;
}

interface CM6LikeEditor extends IEditorEngine {
  getView?: () => EditorView | null;
}

export class ScrollCoordinator implements IScrollCoordinator {
  private enabled = true;
  private isSyncing = false;
  private pendingFrame: number | null = null;
  private unsubscribeEditorScroll: (() => void) | null = null;

  private readonly handlePreviewScroll = (): void => {
    this.syncPreviewToEditor();
  };

  constructor(
    private readonly editor: IEditorEngine,
    private readonly preview: HTMLElement,
    private readonly options: ScrollCoordinatorOptions = {}
  ) {}

  attach(): void {
    if (this.unsubscribeEditorScroll) {
      return;
    }

    this.unsubscribeEditorScroll = this.editor.on('scroll', () => {
      this.syncEditorToPreview();
    });

    this.preview.addEventListener('scroll', this.handlePreviewScroll, { passive: true });
  }

  sync(input: ScrollSyncInput): ScrollSyncOutput {
    if (!this.canSync()) {
      return {
        synced: false,
        targetScrollTop: input.scrollTop,
      };
    }

    const sourceMap = input.sourceMap ?? this.options.getSourceMap?.() ?? null;
    const sourceMapResult = this.resolveUsingSourceMap(input, sourceMap);
    if (sourceMapResult) {
      return sourceMapResult;
    }

    return this.resolveUsingRatio(input, sourceMap ? 'no-anchor-match' : 'missing-map');
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.clearPendingFrame();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  destroy(): void {
    this.disable();

    if (this.unsubscribeEditorScroll) {
      this.unsubscribeEditorScroll();
      this.unsubscribeEditorScroll = null;
    }

    this.preview.removeEventListener('scroll', this.handlePreviewScroll);
  }

  private syncEditorToPreview(): void {
    if (!this.canSync() || this.isSyncing) {
      return;
    }

    const info = this.editor.getScrollInfo();
    const result = this.sync({
      source: 'editor',
      scrollTop: info.top,
      scrollHeight: info.height,
      clientHeight: info.clientHeight,
    });

    if (!result.synced) {
      return;
    }

    this.enterSyncGuard();
    this.preview.scrollTop = result.targetScrollTop;
    this.releaseSyncGuardOnNextFrame();
  }

  private syncPreviewToEditor(): void {
    if (!this.canSync() || this.isSyncing) {
      return;
    }

    const result = this.sync({
      source: 'preview',
      scrollTop: this.preview.scrollTop,
      scrollHeight: this.preview.scrollHeight,
      clientHeight: this.preview.clientHeight,
    });

    if (!result.synced) {
      return;
    }

    this.enterSyncGuard();
    this.editor.scrollTo(result.targetScrollTop);
    this.releaseSyncGuardOnNextFrame();
  }

  private canSync(): boolean {
    return this.enabled && (this.options.isSyncAllowed?.() ?? true);
  }

  private resolveUsingSourceMap(
    input: ScrollSyncInput,
    sourceMap: PreviewSourceMap | null
  ): ScrollSyncOutput | null {
    if (!sourceMap) {
      return null;
    }

    if (sourceMap.totalLines <= 0 || sourceMap.anchors.length === 0) {
      return this.resolveUsingRatio(input, 'missing-map');
    }

    const hasInvalidRange = sourceMap.anchors.some(
      anchor =>
        anchor.lineStart <= 0 ||
        anchor.lineEnd < anchor.lineStart ||
        anchor.lineEnd > sourceMap.totalLines
    );

    if (hasInvalidRange) {
      return this.resolveUsingRatio(input, 'stale-map');
    }

    if (input.source === 'editor') {
      const sourceLine = this.resolveEditorSourceLine(input, sourceMap);
      const matchedAnchorIndex = this.findAnchorIndexByLine(sourceLine, sourceMap);

      if (matchedAnchorIndex < 0) {
        return null;
      }

      const matchedAnchor = sourceMap.anchors[matchedAnchorIndex];
      const nextAnchor = sourceMap.anchors[matchedAnchorIndex + 1] ?? null;
      const lineSpan = Math.max(1, matchedAnchor.lineEnd - matchedAnchor.lineStart + 1);
      const lineProgress = Math.max(
        0,
        Math.min(1, (sourceLine - matchedAnchor.lineStart) / lineSpan)
      );
      const anchorOwnEndOffset = matchedAnchor.offsetTop + (matchedAnchor.offsetHeight ?? 0);
      const anchorEndOffset =
        matchedAnchor.offsetHeight && matchedAnchor.offsetHeight > 0
          ? anchorOwnEndOffset
          : (nextAnchor?.offsetTop ?? anchorOwnEndOffset);
      const interpolatedOffset =
        matchedAnchor.offsetTop +
        Math.max(0, anchorEndOffset - matchedAnchor.offsetTop) * lineProgress;

      const targetRange = Math.max(0, this.preview.scrollHeight - this.preview.clientHeight);
      return {
        synced: true,
        targetScrollTop: Math.max(0, Math.min(interpolatedOffset, targetRange)),
        mode: 'source-map',
      };
    }

    const matchedAnchorIndex = this.findAnchorIndexByPreviewOffset(input.scrollTop, sourceMap);
    const matchedAnchor = sourceMap.anchors[matchedAnchorIndex] ?? sourceMap.anchors[0];
    const nextAnchor = sourceMap.anchors[matchedAnchorIndex + 1] ?? null;
    const anchorOwnEndOffset = matchedAnchor.offsetTop + (matchedAnchor.offsetHeight ?? 0);
    const anchorEndOffset =
      matchedAnchor.offsetHeight && matchedAnchor.offsetHeight > 0
        ? anchorOwnEndOffset
        : (nextAnchor?.offsetTop ?? anchorOwnEndOffset);
    const offsetSpan = Math.max(1, anchorEndOffset - matchedAnchor.offsetTop);
    const offsetProgress = Math.max(
      0,
      Math.min(1, (input.scrollTop - matchedAnchor.offsetTop) / offsetSpan)
    );

    const lineSpan = Math.max(
      1,
      (nextAnchor?.lineStart ?? sourceMap.totalLines + 1) - matchedAnchor.lineStart
    );
    const mappedLine = Math.round(matchedAnchor.lineStart + offsetProgress * lineSpan);

    const exactEditorTop = this.resolveEditorTopForLine(mappedLine);
    if (exactEditorTop !== null) {
      return {
        synced: true,
        targetScrollTop: Math.max(0, exactEditorTop),
        mode: 'source-map',
      };
    }

    const editorMetrics = this.editor.getScrollInfo();
    const editorRange = Math.max(0, editorMetrics.height - editorMetrics.clientHeight);
    const lineRatio = Math.max(
      0,
      Math.min(1, (mappedLine - 1) / Math.max(1, sourceMap.totalLines - 1))
    );

    return {
      synced: true,
      targetScrollTop: Math.max(0, Math.min(editorRange * lineRatio, editorRange)),
      mode: 'source-map',
    };
  }

  private resolveUsingRatio(
    input: ScrollSyncInput,
    fallbackReason: 'missing-map' | 'stale-map' | 'no-anchor-match'
  ): ScrollSyncOutput {
    const sourceRange = Math.max(0, input.scrollHeight - input.clientHeight);
    const ratio = sourceRange <= 0 ? 0 : input.scrollTop / sourceRange;

    const targetMetrics =
      input.source === 'editor'
        ? {
            scrollHeight: this.preview.scrollHeight,
            clientHeight: this.preview.clientHeight,
          }
        : (() => {
            const info = this.editor.getScrollInfo();
            return {
              scrollHeight: info.height,
              clientHeight: info.clientHeight,
            };
          })();

    const targetRange = Math.max(0, targetMetrics.scrollHeight - targetMetrics.clientHeight);

    return {
      synced: true,
      targetScrollTop: ratio * targetRange,
      mode: 'ratio-fallback',
      fallbackReason,
    };
  }

  private findAnchorIndexByLine(sourceLine: number, sourceMap: PreviewSourceMap): number {
    for (let index = 0; index < sourceMap.anchors.length; index += 1) {
      const anchor = sourceMap.anchors[index];
      if (sourceLine >= anchor.lineStart && sourceLine <= anchor.lineEnd) {
        return index;
      }
    }

    return -1;
  }

  private findAnchorIndexByPreviewOffset(scrollTop: number, sourceMap: PreviewSourceMap): number {
    let matchedAnchorIndex = 0;

    for (let index = 0; index < sourceMap.anchors.length; index += 1) {
      if (sourceMap.anchors[index].offsetTop <= scrollTop) {
        matchedAnchorIndex = index;
      } else {
        break;
      }
    }

    return matchedAnchorIndex;
  }

  private resolveEditorSourceLine(input: ScrollSyncInput, sourceMap: PreviewSourceMap): number {
    const view = (this.editor as CM6LikeEditor).getView?.() ?? null;
    if (view) {
      const viewportBlocks = view.viewportLineBlocks;
      if (viewportBlocks.length > 0) {
        let targetBlock = viewportBlocks[0];
        for (const block of viewportBlocks) {
          if (block.top <= input.scrollTop) {
            targetBlock = block;
          } else {
            break;
          }
        }

        return view.state.doc.lineAt(targetBlock.from).number;
      }
    }

    const sourceRange = Math.max(0, input.scrollHeight - input.clientHeight);
    const sourceRatio = sourceRange <= 0 ? 0 : input.scrollTop / sourceRange;
    return Math.round(sourceRatio * Math.max(0, sourceMap.totalLines - 1)) + 1;
  }

  private resolveEditorTopForLine(lineNumber: number): number | null {
    const view = (this.editor as CM6LikeEditor).getView?.() ?? null;
    if (!view) {
      return null;
    }

    const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
    const linePos = view.state.doc.line(safeLine).from;
    return view.lineBlockAt(linePos).top;
  }

  private enterSyncGuard(): void {
    this.isSyncing = true;
  }

  private releaseSyncGuardOnNextFrame(): void {
    this.clearPendingFrame();
    this.pendingFrame = requestAnimationFrame(() => {
      this.isSyncing = false;
      this.pendingFrame = null;
    });
  }

  private clearPendingFrame(): void {
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }

    this.isSyncing = false;
  }
}
