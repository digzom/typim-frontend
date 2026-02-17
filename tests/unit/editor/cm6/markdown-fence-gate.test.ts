import { describe, expect, it } from 'vitest';
import { resolveFenceHighlightGate } from '../../../../src/main';

describe('FenceHighlightFeatureGateV1', () => {
  it('returns live-markdown-active branch when live markdown is enabled', () => {
    expect(resolveFenceHighlightGate(true, true, true)).toEqual({
      attachFenceHighlighting: false,
      reason: 'live-markdown-active',
    });
  });

  it('enables highlighting only for cm6 + feature enabled + live mode off', () => {
    expect(resolveFenceHighlightGate(true, true, false)).toEqual({
      attachFenceHighlighting: true,
      reason: 'enabled',
    });
    expect(resolveFenceHighlightGate(true, false, false)).toEqual({
      attachFenceHighlighting: false,
      reason: 'feature-disabled',
    });
    expect(resolveFenceHighlightGate(false, true, false)).toEqual({
      attachFenceHighlighting: false,
      reason: 'cm5-engine',
    });
  });
});
