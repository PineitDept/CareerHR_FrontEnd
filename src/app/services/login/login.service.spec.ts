import { TestBed } from '@angular/core/testing';
import { LoginService } from './login.service';
import { ApiService } from '../../shared/services/api/api.service';
import { AuthService } from '../../shared/services/auth/auth.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ILoginRequest, ILoginResponse, ILogoutRequest } from '../../interfaces/login/login.interface';

describe('LoginService', () => {
  let service: LoginService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj('ApiService', ['post']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['saveTokens', 'clearTokens']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        LoginService,
        { provide: ApiService, useValue: apiServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(LoginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login()', () => {
    it('should call apiService.post and save tokens', () => {
      const credentials: ILoginRequest = { emp_id: '123', password: 'pass' };
      const response: ILoginResponse = {
        accessToken: 'access123',
        refreshToken: 'refresh123'
      };

      apiServiceSpy.post.and.returnValue(of(response));

      service.login(credentials).subscribe(res => {
        expect(res).toEqual(response);
        expect(apiServiceSpy.post).toHaveBeenCalledWith(
          'users/login',
          credentials,
          { withAuth: false, loading: true }
        );
        expect(authServiceSpy.saveTokens).toHaveBeenCalledWith('access123', 'refresh123');
      });
    });
  });

  describe('logout()', () => {
    it('should call apiService.post, clear tokens, and redirect to login', () => {
      const payload: ILogoutRequest = { refreshToken: 'refresh123' };
      apiServiceSpy.post.and.returnValue(of({}));

      service.logout(payload).subscribe(() => {
        expect(apiServiceSpy.post).toHaveBeenCalledWith(
          'users/logout',
          payload,
          { withAuth: true, loading: true }
        );
        expect(authServiceSpy.clearTokens).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
      });
    });
  });
});
