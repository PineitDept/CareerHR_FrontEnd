import { TestBed } from '@angular/core/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../../shared/services/auth/auth.service';
import { Router } from '@angular/router';
import { UrlTree } from '@angular/router';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getAccessToken']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should return true when access token exists', () => {
    authServiceSpy.getAccessToken.and.returnValue('valid_token');

    const result = guard.canActivate({} as any, {} as any);

    expect(result).toBeTrue();
    expect(authServiceSpy.getAccessToken).toHaveBeenCalled();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to /login when access token is missing', () => {
    authServiceSpy.getAccessToken.and.returnValue(null);

    const fakeUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    const result = guard.canActivate({} as any, {} as any);

    expect(authServiceSpy.getAccessToken).toHaveBeenCalled();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(fakeUrlTree);
  });

  it('should work with undefined route or state params', () => {
    authServiceSpy.getAccessToken.and.returnValue(null);
    routerSpy.createUrlTree.and.returnValue({} as UrlTree);

    const result = guard.canActivate(undefined as any, undefined as any);

    expect(result).toEqual(jasmine.any(Object)); // should be UrlTree
  });
});
