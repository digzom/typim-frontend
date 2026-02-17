import { describe, expect, it, vi } from 'vitest';
import { ShareClient } from '../../../../src/features/share/client';
import type { SharePayload } from '../../../../src/core/types';

function createPayload(type: 'static' | 'live' = 'static'): SharePayload {
  return {
    title: 'Test',
    content: '# Test',
    type,
    privacy: 'secret',
  };
}

describe('ShareClient', () => {
  it('creates a share link and stores live session in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'share-1',
        url: 'https://example.test/s/share-1',
        shareType: 'live',
        privacy: 'secret',
        editToken: 'edit-token',
      }),
    });

    const client = new ShareClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await client.create(createPayload('live'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.id).toBe('share-1');
    expect(result.url).toBe('https://example.test/s/share-1');
    expect(client.getLiveSession()).toEqual({
      id: 'share-1',
      editToken: 'edit-token',
    });
  });

  it('updates a live share using edit token header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'share-1',
        url: 'https://example.test/s/share-1',
        shareType: 'live',
        privacy: 'secret',
      }),
    });

    const client = new ShareClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await client.update('share-1', 'edit-token', createPayload('live'));

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/share/share-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Share-Edit-Token': 'edit-token',
      },
      body: JSON.stringify({
        title: 'Test',
        content: '# Test',
      }),
    });
  });
});
