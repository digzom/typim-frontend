import type { IShareClient, SharePayload, ShareResponse } from '../../core/types';
import { ShareError } from '../../core/errors';
import type {
  InMemoryShareSession,
  ShareApiPayload,
  ShareApiResponse,
  ShareUpdatePayload,
} from './types';

interface ShareClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class ShareClient implements IShareClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private liveSession: InMemoryShareSession | null = null;

  constructor(options: ShareClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async create(payload: SharePayload): Promise<ShareResponse> {
    const requestPayload: ShareApiPayload = {
      title: payload.title,
      content: payload.content,
      shareType: payload.type,
      privacy: payload.privacy,
    };

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Share service unavailable.',
        };
      }

      const data = (await response.json()) as ShareApiResponse;
      if (data.shareType === 'live' && data.editToken) {
        this.liveSession = {
          id: data.id,
          editToken: data.editToken,
        };
      }

      return {
        success: true,
        id: data.id,
        url: data.url,
      };
    } catch (error) {
      const shareError = new ShareError('Failed to create share link', 'createShare', {
        payload: {
          title: payload.title,
          type: payload.type,
          privacy: payload.privacy,
        },
      });

      console.error('[ShareClient] create failed', shareError, error);

      return {
        success: false,
        error: 'Share service unavailable.',
      };
    }
  }

  async update(id: string, editToken: string, payload: SharePayload): Promise<ShareResponse> {
    const requestPayload: ShareUpdatePayload = {
      title: payload.title,
      content: payload.content,
    };

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/share/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Share-Edit-Token': editToken,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Live share update failed.',
        };
      }

      const data = (await response.json()) as ShareApiResponse;

      return {
        success: true,
        id,
        url: data.url,
      };
    } catch (error) {
      const shareError = new ShareError('Failed to update live share', 'updateLiveShare', {
        id,
      });

      console.error('[ShareClient] update failed', shareError, error);

      return {
        success: false,
        error: 'Live share update failed.',
      };
    }
  }

  getLiveSession(): InMemoryShareSession | null {
    return this.liveSession;
  }

  clearLiveSession(): void {
    this.liveSession = null;
  }
}
