import { TestBed } from '@angular/core/testing';
import { LoginGuard } from './login.guard';
import { AuthService } from '../../shared/services/auth/auth.service';
import { Router, UrlTree } from '@angular/router';

describe('LoginGuard', () => {
  let guard: LoginGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getAccessToken']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        LoginGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(LoginGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access when no access token exists (can login)', () => {
    authServiceSpy.getAccessToken.and.returnValue(null);

    const result = guard.canActivate({} as any, {} as any);

    expect(result).toBeTrue();
    expect(authServiceSpy.getAccessToken).toHaveBeenCalled();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to /index when access token exists', () => {
    authServiceSpy.getAccessToken.and.returnValue('existing_token');

    const fakeUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    const result = guard.canActivate({} as any, {} as any);

    expect(authServiceSpy.getAccessToken).toHaveBeenCalled();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/index']);
    expect(result).toBe(fakeUrlTree);
  });

  it('should work when route/state are undefined', () => {
    authServiceSpy.getAccessToken.and.returnValue(null);

    const result = guard.canActivate(undefined as any, undefined as any);

    expect(result).toBeTrue();
    expect(authServiceSpy.getAccessToken).toHaveBeenCalled();
  });
});
