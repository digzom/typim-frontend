import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export const DEFAULT_SCROLLOFF_MARGIN_PX = 120;

export interface ScrolloffViewportPolicyInput {
  cursorLine: number;
  totalLines: number;
  viewportHeight: number;
  defaultMarginPx: number;
}

export interface ScrolloffViewportPolicyResult {
  topMarginPx: number;
  bottomMarginPx: number;
  clampedAtBoundary: boolean;
}

export function resolveScrolloffViewportPolicy(
  input: ScrolloffViewportPolicyInput
): ScrolloffViewportPolicyResult {
  const margin = Math.max(0, Math.min(input.defaultMarginPx, Math.floor(input.viewportHeight / 2)));
  const topMarginPx = input.cursorLine <= 1 ? 0 : margin;
  const bottomMarginPx = input.cursorLine >= input.totalLines ? 0 : margin;

  return {
    topMarginPx,
    bottomMarginPx,
    clampedAtBoundary: topMarginPx !== margin || bottomMarginPx !== margin,
  };
}

export function createScrolloffExtension(defaultMarginPx = DEFAULT_SCROLLOFF_MARGIN_PX): Extension {
  return EditorView.scrollMargins.of(view => {
    const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
    const policy = resolveScrolloffViewportPolicy({
      cursorLine,
      totalLines: view.state.doc.lines,
      viewportHeight: view.scrollDOM.clientHeight,
      defaultMarginPx,
    });

    return {
      top: policy.topMarginPx,
      bottom: policy.bottomMarginPx,
    };
  });
}
