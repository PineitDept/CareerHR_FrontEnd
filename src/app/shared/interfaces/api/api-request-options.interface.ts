import { HttpContext, HttpContextToken } from '@angular/common/http';

export type ApiObserve = 'body' | 'response' | 'events';

export const WITH_AUTH = new HttpContextToken(() => true);

export interface ApiRequestOptionsBase {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  baseUrl?: string;
  responseType?: 'json' | 'blob' | 'text';
  context?: HttpContext;

  retry?: number;
  timeoutMs?: number;
  withAuth?: boolean;
  loading?: boolean;
  feature?: string;
  abortSignal?: AbortSignal;
  // withCredentials?: boolean;
}

// For observe: 'body'
export interface ApiRequestOptionsBody extends ApiRequestOptionsBase {
  observe?: 'body';
}

// For observe: 'response'
export interface ApiRequestOptionsResponse extends ApiRequestOptionsBase {
  observe: 'response';
}

// For observe: 'events'
export interface ApiRequestOptionsEvents extends ApiRequestOptionsBase {
  observe: 'events';
}

export type ApiRequestOptions =
  | ApiRequestOptionsBody
  | ApiRequestOptionsResponse
  | ApiRequestOptionsEvents;
