export type ShareType = 'static' | 'live';
export type SharePrivacy = 'secret' | 'public';

export interface ShareApiPayload {
  title: string;
  content: string;
  shareType: ShareType;
  privacy: SharePrivacy;
}

export interface ShareUpdatePayload {
  title: string;
  content: string;
}

export interface ShareApiResponse {
  id: string;
  url: string;
  shareType: ShareType;
  privacy: SharePrivacy;
  editToken?: string;
}

export interface InMemoryShareSession {
  id: string;
  editToken: string;
}
