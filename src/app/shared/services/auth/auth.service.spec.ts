import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ApiService } from '../api/api.service';
import { of, throwError, defer } from 'rxjs';
import { delay } from 'rxjs/operators';

describe('AuthService', () => {
  let service: AuthService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['post']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: apiSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Token Storage', () => {
    it('should save and get tokens', fakeAsync(() => {
      service.saveTokens('abc', 'def');
      expect(service.getAccessToken()).toBe('abc');
      expect(service.getRefreshToken()).toBe('def');
    }));

    it('should clear tokens', fakeAsync(() => {
      service.saveTokens('abc', 'def');
      service.clearTokens();
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
    }));
  });

  describe('refreshToken()', () => {
    it('should call refresh endpoint and update tokens', fakeAsync(() => {
      service.saveTokens('oldAccess', 'refreshToken');
      const newAccess = 'newAccessToken';

      apiSpy.post.and.returnValue(of({ accessToken: newAccess }));

      let result!: string;

      service.refreshToken().subscribe(token => {
        result = token;
      });

      tick();

      expect(apiSpy.post).toHaveBeenCalledWith('users/refresh', {
        refreshToken: 'refreshToken'
      }, { withAuth: false, loading: false });

      expect(result).toBe(newAccess);
      expect(service.getAccessToken()).toBe(newAccess);
      expect(service.getRefreshToken()).toBe('refreshToken');
    }));

    it('should queue calls if already refreshing', fakeAsync(() => {
      service.saveTokens('access', 'refreshToken');
      const response = { accessToken: 'token1' };
      let callCount = 0;

      apiSpy.post.and.returnValue(
        defer(() => {
          callCount++;
          return of(response).pipe(delay(10)); // Simulate API response delay of 10ms
        })
      );

      const results: string[] = [];

      service.refreshToken().subscribe(token => results.push(token));

      tick(1); // Allow the first call to start (isRefreshing = true)

      service.refreshToken().subscribe(token => results.push(token));

      tick(20); // Wait for the delay to finish and observable to complete

      expect(results[0]).toBe('token1');
      expect(results[1]).toBe('token1');
      expect(callCount).toBe(1); // Should call the API only once
    }));

    it('should clear tokens on refresh error', fakeAsync(() => {
      service.saveTokens('access', 'refreshToken');

      apiSpy.post.and.returnValue(throwError(() => new Error('invalid')));

      let errorCaught!: any;

      service.refreshToken().subscribe({
        next: () => {},
        error: (err) => {
          errorCaught = err;
        }
      });

      tick();

      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(errorCaught).toBeTruthy();
    }));

    it('should not call API if refresh token is null', fakeAsync(() => {
      spyOn(service, 'getRefreshToken').and.returnValue(null);
      apiSpy.post.and.returnValue(of({ accessToken: 'new' }));

      let errorCaught!: any;

      service.refreshToken().subscribe({
        next: () => {},
        error: (err) => (errorCaught = err)
      });

      tick();

      expect(apiSpy.post).not.toHaveBeenCalled();
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(errorCaught).toBeTruthy();
    }));

    it('should emit to refreshTokenSubject and allow late subscribers to receive token', fakeAsync(() => {
      service.saveTokens('access', 'refreshToken');
      apiSpy.post.and.returnValue(of({ accessToken: 'delayed-token' }));

      service.refreshToken().subscribe();

      tick();

      service.refreshToken().subscribe((token) => {
        expect(token).toBe('delayed-token');
      });

      tick();
    }));

    it('should throw error if refresh token is null', fakeAsync(() => {
      spyOn(service, 'getRefreshToken').and.returnValue(null);
      apiSpy.post.and.returnValue(of({ accessToken: 'new-token' }));

      let errorCaught!: any;

      service.refreshToken().subscribe({
        error: (err) => {
          errorCaught = err;
        }
      });

      tick();

      expect(apiSpy.post).not.toHaveBeenCalled();
      expect(errorCaught).toBeTruthy();
      expect(errorCaught.message).toBe('No refresh token');
    }));
  });
});
