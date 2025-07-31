import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpResponse,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
  HttpContext,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiInterceptorFn } from './api.interceptor';
import { AuthService } from '../../services/auth/auth.service';
import { RedirectService } from '../../services/redirect/redirect.service';
import { NotificationService } from '../../services/notification/notification.service';
import { WITH_AUTH } from '../../interfaces/api/api-request-options.interface';

describe('ApiInterceptorFn', () => {
  let authService: AuthService;
  let injector: EnvironmentInjector;
  let redirectService: RedirectService;
  let notificationService: jasmine.SpyObj<NotificationService>;

  function callInterceptorFn(
    req: HttpRequest<any>,
    next: HttpHandlerFn
  ) {
    return runInInjectionContext(injector, () =>
      ApiInterceptorFn(req, next)
    );
  }

  beforeEach(() => {
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        RedirectService,
        { provide: NotificationService, useValue: notificationSpy },
        provideHttpClient(withInterceptors([ApiInterceptorFn])),
      ],
    });

    authService = TestBed.inject(AuthService);
    redirectService = TestBed.inject(RedirectService);
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    injector = TestBed.inject(EnvironmentInjector);
  });

  it('should be created', () => {
    const req = new HttpRequest('GET', '/test');
    const next: HttpHandlerFn = (req) => of(new HttpResponse({ status: 200 }));

    expect(() => {
      callInterceptorFn(req, next).subscribe();
    }).not.toThrow();
  });

  // === GROUP 1: AUTHORIZATION HEADER ===
  describe('Authorization Header', () => {
    it('should attach Authorization header if accessToken exists and withAuth=true', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('mock-token');

      const req = new HttpRequest('GET', '/api/test', {
        context: new HttpContext().set(WITH_AUTH, true),
      });

      const next: HttpHandlerFn = (req) => {
        expect(req.headers.get('Authorization')).toBe('Bearer mock-token');
        return of(new HttpResponse({ status: 200 }));
      };

      callInterceptorFn(req, next).subscribe(() => done());
    });

    it('should not attach Authorization header if withAuth=false', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('mock-token');

      const req = new HttpRequest('GET', '/api/no-auth', {
        context: new HttpContext().set(WITH_AUTH, false),
      });

      const next: HttpHandlerFn = (req) => {
        expect(req.headers.has('Authorization')).toBeFalse();
        return of(new HttpResponse({ status: 200 }));
      };

      callInterceptorFn(req, next).subscribe(() => done());
    });

    it('should not attach Authorization header if no accessToken', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue(null);

      const req = new HttpRequest('GET', '/api/test');
      const next: HttpHandlerFn = (req) => {
        expect(req.headers.has('Authorization')).toBeFalse();
        return of(new HttpResponse({ status: 200 }));
      };

      callInterceptorFn(req, next).subscribe(() => done());
    });
  });

  // === GROUP 2: TOKEN REFRESH ===
  describe('Token Refresh', () => {
    it('should refresh token and retry request on 401 error when withAuth=true', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('expired-token');
      spyOn(authService, 'refreshToken').and.returnValue(of('new-token'));

      const req = new HttpRequest('GET', '/api/test', {
        context: new HttpContext().set(WITH_AUTH, true),
      });

      let callCount = 0;

      const next: HttpHandlerFn = (req) => {
        callCount++;
        if (callCount === 1) {
          expect(req.headers.get('Authorization')).toBe('Bearer expired-token');
          return throwError(() => new HttpErrorResponse({ status: 401 }));
        } else {
          expect(req.headers.get('Authorization')).toBe('Bearer new-token');
          return of(new HttpResponse({ status: 200 }));
        }
      };

      callInterceptorFn(req, next).subscribe(() => {
        expect(callCount).toBe(2);
        done();
      });
    });

    it('should NOT refresh token on 401 error if withAuth=false', (done) => {
      spyOn(authService, 'refreshToken');

      const req = new HttpRequest('GET', '/api/test', {
        context: new HttpContext().set(WITH_AUTH, false),
      });

      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status: 401 }));

      callInterceptorFn(req, next).subscribe({
        error: (err: any) => {
          expect(authService.refreshToken).not.toHaveBeenCalled();
          expect(err.status).toBe(401);
          done();
        },
      });
    });

    it('should clear tokens, notify, and redirect on refresh token failure', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('expired-token');
      spyOn(authService, 'refreshToken').and.returnValue(
        throwError(() => new Error('Refresh Failed'))
      );
      const clearTokensSpy = spyOn(authService, 'clearTokens');
      const redirectSpy = spyOn(redirectService, 'redirectToLogin');

      const req = new HttpRequest('GET', '/api/test', {
        context: new HttpContext().set(WITH_AUTH, true),
      });

      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status: 401 }));

      callInterceptorFn(req, next).subscribe({
        error: (err: any) => {
          expect(clearTokensSpy).toHaveBeenCalled();
          expect(redirectSpy).toHaveBeenCalled();
          expect(notificationService.error).toHaveBeenCalledWith('Session expired, please log in again.');
          expect(err.message).toBe('Refresh Failed');
          done();
        },
      });
    });

    it('should handle null from refreshToken gracefully', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('expired-token');
      spyOn(authService, 'refreshToken').and.returnValue(of(null as unknown as string)); // ← intentionally returns null

      const clearTokensSpy = spyOn(authService, 'clearTokens');
      const redirectSpy = spyOn(redirectService, 'redirectToLogin');

      const req = new HttpRequest('GET', '/api/test', {
        context: new HttpContext().set(WITH_AUTH, true),
      });

      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status: 401 }));

      callInterceptorFn(req, next).subscribe({
        error: (err) => {
          expect(clearTokensSpy).toHaveBeenCalled();
          expect(redirectSpy).toHaveBeenCalled();
          expect(notificationService.error).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should handle case when getRefreshToken() returns null', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('expired-token');
      spyOn(authService, 'getRefreshToken').and.returnValue(null); // ← simulate null
      spyOn(authService, 'refreshToken').and.callThrough();

      const clearTokensSpy = spyOn(authService, 'clearTokens');
      const redirectSpy = spyOn(redirectService, 'redirectToLogin');

      const req = new HttpRequest('GET', '/api/test', {
        context: new HttpContext().set(WITH_AUTH, true),
      });

      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status: 401 }));

      callInterceptorFn(req, next).subscribe({
        error: (err) => {
          expect(clearTokensSpy).toHaveBeenCalled();
          expect(redirectSpy).toHaveBeenCalled();
          expect(notificationService.error).toHaveBeenCalledWith('Session expired, please log in again.');
          expect(err.message).toBe('No refresh token');
          done();
        },
      });
    });
  });

  // === GROUP 3: OTHER ERRORS ===
  describe('Other Errors', () => {
    it('should pass through non-401 errors without retry', (done) => {
      spyOn(authService, 'getAccessToken').and.returnValue('valid-token');
      const clearTokensSpy = spyOn(authService, 'clearTokens');

      const req = new HttpRequest('GET', '/api/test');

      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status: 403 }));

      callInterceptorFn(req, next).subscribe({
        error: (err: any) => {
          expect(clearTokensSpy).not.toHaveBeenCalled();
          expect(err.status).toBe(403);
          done();
        },
      });
    });
  });
});

