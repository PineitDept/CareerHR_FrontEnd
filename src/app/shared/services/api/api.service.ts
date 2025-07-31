import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
  HttpResponse,
  HttpEvent,
  HttpContext
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, finalize, timeout, retry } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { LoadingService } from '../loading/loading.service';
import { NotificationService } from '../notification/notification.service';
import {
  ApiRequestOptions,
  ApiObserve,
  WITH_AUTH
} from '../../interfaces/api/api-request-options.interface';
import { ApiError } from '../../interfaces/api/api-error.interface';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor() {}

  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private loader = inject(LoadingService);
  private notifier = inject(NotificationService);

  private buildHeaders(opts?: ApiRequestOptions): HttpHeaders {
    let headers = new HttpHeaders(opts?.headers || {});
    if (!headers.has('Content-Type')) {
      headers = headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  private buildParams(params?: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        httpParams = httpParams.set(k, String(v));
      }
    });
    return httpParams;
  }

  private handleError(error: any): Observable<never> {
    const apiError: ApiError = {
      status: error.status || 0,
      message: error?.error?.message || error?.message || 'Unknown error',
      error,
      type: this.mapErrorType(error)
    };
    return throwError(() => apiError);
  }

  private mapErrorType(error: any): ApiError['type'] {
    if (error.status === 0) return 'Network';
    if (error.status >= 500) return 'Server';
    if (error.status === 401) return 'Unauthorized';
    if (error.status === 403) return 'Forbidden';
    if (error.status === 404) return 'NotFound';
    if (error.status === 400 && error.error?.validationErrors) return 'Validation';
    return 'Server';
  }

  private withRetry<T>(req$: Observable<T>, count = 0): Observable<T> {
    return req$.pipe(
      retry({
        count,
        delay: (_, retryCount) => timer(500 * retryCount)
      })
    );
  }

  request<T>(
    method: string,
    endpoint: string,
    body: any,
    opts: ApiRequestOptions = {}
  ): Observable<any> {
    const url = `${opts.baseUrl || this.baseUrl}/${endpoint}`;
    const headers = this.buildHeaders(opts);
    const params = this.buildParams(opts.params);
    const signal = opts.abortSignal ?? new AbortController().signal;
    const observe: ApiObserve = opts.observe ?? 'body';
    const context = (opts.context ?? new HttpContext()).set(WITH_AUTH, opts.withAuth ?? true);

    const reqOpts = {
      body,
      headers,
      params,
      observe,
      responseType: opts.responseType ?? 'json',
      context,
      signal
    } as any;

    if (opts.loading) this.loader.show();

    let request$ = this.http.request(method, url, reqOpts).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => opts.loading && this.loader.hide())
    );

    if (opts.timeoutMs) {
      request$ = request$.pipe(timeout(opts.timeoutMs));
    }

    if (opts.retry) {
      request$ = this.withRetry(request$, opts.retry);
    }

    return request$;
  }

  get<T>(endpoint: string, opts?: ApiRequestOptions): Observable<any> {
    return this.request<T>('GET', endpoint, null, opts ?? {});
  }

  post<T>(endpoint: string, body: any, opts?: ApiRequestOptions): Observable<any> {
    return this.request<T>('POST', endpoint, body, opts ?? {});
  }

  put<T>(endpoint: string, body: any, opts?: ApiRequestOptions): Observable<any> {
    return this.request<T>('PUT', endpoint, body, opts ?? {});
  }

  patch<T>(endpoint: string, body: any, opts?: ApiRequestOptions): Observable<any> {
    return this.request<T>('PATCH', endpoint, body, opts ?? {});
  }

  delete<T>(endpoint: string, opts?: ApiRequestOptions): Observable<any> {
    return this.request<T>('DELETE', endpoint, null, opts ?? {});
  }
}
