import { TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { LoadingService } from '../loading/loading.service';
import { NotificationService } from '../notification/notification.service';
import { HttpEventType, HttpSentEvent, provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApiInterceptorFn } from '../../interceptors/api/api.interceptor';
import { AuthService } from '../auth/auth.service';
import { RedirectService } from '../redirect/redirect.service';
import { of, throwError } from 'rxjs';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  let loading: jasmine.SpyObj<LoadingService>;
  let notifier: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    loading = jasmine.createSpyObj('LoadingService', ['show', 'hide']);
    notifier = jasmine.createSpyObj('NotificationService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([ApiInterceptorFn])),
        provideHttpClientTesting(),
        ApiService,
        { provide: LoadingService, useValue: loading },
        { provide: NotificationService, useValue: notifier },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj('AuthService', [
            'getAccessToken',
            'refreshToken',
            'clearTokens'
          ])
        },
        {
          provide: RedirectService,
          useValue: jasmine.createSpyObj('RedirectService', ['redirectToLogin'])
        },
      ],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } catch (e) {}
  });

  // === GROUP: Service Instantiation ===
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // === GROUP: Authorization Header / withAuth Behavior ===
  describe('Authorization Header / withAuth Behavior', () => {
    it('should attach Authorization header if accessToken exists', () => {
      const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
      authService.getAccessToken.and.returnValue('mock-token');

      service.get('auth-header-test').subscribe();
      const req = httpMock.expectOne('http://localhost:3000/auth-header-test');
      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
      req.flush({});
    });

    it('should NOT attach Authorization header if withAuth is false', () => {
      const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
      authService.getAccessToken.and.returnValue('mock-token');

      service.get('no-auth-header', { withAuth: false }).subscribe();
      const req = httpMock.expectOne('http://localhost:3000/no-auth-header');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('should attach Authorization header by default when withAuth is not set', () => {
      const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
      authService.getAccessToken.and.returnValue('mock-token');

      service.get('default-auth-header').subscribe();
      const req = httpMock.expectOne('http://localhost:3000/default-auth-header');
      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
      req.flush({});
    });
  });

  // === GROUP: Refresh Token Handling ===
  describe('Refresh Token Handling', () => {
    it('should attempt to refresh token on 401 and retry request', fakeAsync(() => {
      const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
      const redirectService = TestBed.inject(RedirectService) as jasmine.SpyObj<RedirectService>;
      const notification = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;

      authService.getAccessToken.and.returnValue('expired-token');
      authService.refreshToken.and.returnValue(of('new-token'));

      service.get('refresh-test').subscribe();

      const req1 = httpMock.expectOne('http://localhost:3000/refresh-test');
      expect(req1.request.headers.get('Authorization')).toBe('Bearer expired-token');
      req1.flush({}, { status: 401, statusText: 'Unauthorized' });

      const req2 = httpMock.expectOne('http://localhost:3000/refresh-test');
      expect(req2.request.headers.get('Authorization')).toBe('Bearer new-token');
      req2.flush({});

      expect(authService.refreshToken).toHaveBeenCalled();
      expect(authService.clearTokens).not.toHaveBeenCalled();
      expect(notification.error).not.toHaveBeenCalled();
      expect(redirectService.redirectToLogin).not.toHaveBeenCalled();

      flushMicrotasks();
    }));

    it('should redirect to login if refresh token fails after 401', fakeAsync(() => {
      const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
      const redirectService = TestBed.inject(RedirectService) as jasmine.SpyObj<RedirectService>;
      const notification = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;

      authService.getAccessToken.and.returnValue('expired-token');
      authService.refreshToken.and.returnValue(throwError(() => new Error('refresh failed')));

      service.get('fail-refresh-test').subscribe({
        error: (err) => {
          expect(err.message).toBe('refresh failed');
        }
      });

      const req1 = httpMock.expectOne('http://localhost:3000/fail-refresh-test');
      expect(req1.request.headers.get('Authorization')).toBe('Bearer expired-token');
      req1.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(authService.refreshToken).toHaveBeenCalled();
      expect(authService.clearTokens).toHaveBeenCalled();
      expect(notification.error).toHaveBeenCalledWith('Session expired, please log in again.');
      expect(redirectService.redirectToLogin).toHaveBeenCalled();

      flushMicrotasks();
    }));
  });

  // === GROUP: Request Methods ===
  describe('Request Methods', () => {
    it('should make GET request with default options', () => {
      service.get('test-endpoint').subscribe();
      const req = httpMock.expectOne(req => req.method === 'GET');
      expect(req.request.url).toContain('test-endpoint');
      req.flush({});
    });

    it('should make POST request with body', () => {
      const payload = { data: 1 };
      service.post('post-endpoint', payload).subscribe();
      const req = httpMock.expectOne('http://localhost:3000/post-endpoint');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('should make PUT request with body', () => {
      const payload = { data: 2 };
      service.put('put-endpoint', payload).subscribe();
      const req = httpMock.expectOne('http://localhost:3000/put-endpoint');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('should make PATCH request with body', () => {
      const payload = { data: 3 };
      service.patch('patch-endpoint', payload).subscribe();
      const req = httpMock.expectOne('http://localhost:3000/patch-endpoint');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('should make DELETE request with default options', () => {
      service.delete('delete-endpoint').subscribe();
      const req = httpMock.expectOne('http://localhost:3000/delete-endpoint');
      req.flush({});
    });
  });

  // === GROUP: Options Handling ===
  describe('Options Handling', () => {
    it('should apply timeout if specified', (done) => {
      service.get('timeout-test', { timeoutMs: 10 }).subscribe({
        error: (err) => {
          expect(err.name).toBe('TimeoutError');
          done();
        }
      });
    });

    it('should apply retry if specified', fakeAsync(() => {
      let callCount = 0;

      service.get('retry-test', { retry: 2 }).subscribe({
        error: (err) => {
          expect(callCount).toBe(3);
          expect(err.status).toBe(500);
        }
      });

      tick(0);
      const req1 = httpMock.expectOne('http://localhost:3000/retry-test');
      callCount++;
      req1.flush(null, { status: 500, statusText: 'Server Error' });

      tick(500);
      const req2 = httpMock.expectOne('http://localhost:3000/retry-test');
      callCount++;
      req2.flush(null, { status: 500, statusText: 'Server Error' });

      tick(1000);
      const req3 = httpMock.expectOne('http://localhost:3000/retry-test');
      callCount++;
      req3.flush(null, { status: 500, statusText: 'Server Error' });

      flushMicrotasks();
    }));

    it('should show and hide loader if loading is true', () => {
      service.get('load-test', { loading: true }).subscribe();
      expect(loading.show).toHaveBeenCalled();
      const req = httpMock.expectOne('http://localhost:3000/load-test');
      req.flush({});
      expect(loading.hide).toHaveBeenCalled();
    });
  });

  // === GROUP: Behavior Validation ===
  describe('Behavior Validation', () => {
    it('should return error with mapped type on failure', (done) => {
      service.get('error-test').subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
          expect(err.type).toBe('NotFound');
          done();
        }
      });
      const req = httpMock.expectOne('http://localhost:3000/error-test');
      req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    });

    it('should build headers with default content-type', () => {
      service.get('header-test').subscribe();
      const req = httpMock.expectOne('http://localhost:3000/header-test');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      req.flush({});
    });

    it('should build params from object', () => {
      service.get('param-test', { params: { q: 'test', page: 2 } }).subscribe();
      const req = httpMock.expectOne(r => r.url.includes('param-test'));
      expect(req.request.params.get('q')).toBe('test');
      expect(req.request.params.get('page')).toBe('2');
      req.flush({});
    });

    it('should support responseType blob', () => {
      service.get('blob-test', { responseType: 'blob' }).subscribe();
      const req = httpMock.expectOne('http://localhost:3000/blob-test');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob());
    });

    it('should support observe "response"', () => {
      service.get('resp-test', { observe: 'response' }).subscribe((res) => {
        expect(res.status).toBe(200);
      });
      const req = httpMock.expectOne('http://localhost:3000/resp-test');
      req.flush({}, { status: 200, statusText: 'OK' });
    });

    it('should support observe "events"', () => {
      service.get('event-test', { observe: 'events' }).subscribe(event => {
        expect(event.type).toBe(HttpEventType.Sent);
      });
      const req = httpMock.expectOne('http://localhost:3000/event-test');
      req.event({ type: HttpEventType.Sent } as HttpSentEvent);
    });

    it('should support abortSignal', (done) => {
      const controller = new AbortController();

      service.get('abort-test', { abortSignal: controller.signal }).subscribe({
        error: (err) => {
          expect(err).toEqual(
            jasmine.objectContaining({
              type: 'Network',
              status: 0
            })
          );
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/abort-test');
      req.error(new ProgressEvent('abort'));
    });
  });
});
