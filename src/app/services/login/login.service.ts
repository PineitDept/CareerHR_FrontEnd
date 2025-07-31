import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api/api.service';
import { Observable, tap } from 'rxjs';
import { AuthService } from '../../shared/services/auth/auth.service';
import { ILoginRequest, ILoginResponse, ILogoutRequest } from '../../interfaces/login/login.interface';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) { }

  login(credentials: ILoginRequest): Observable<ILoginResponse> {
    return this.apiService.post<ILoginResponse>('users/login', credentials, {
      withAuth: false,  // No token attached
      loading: true     // Trigger loading indicator
    }).pipe(
      tap(res => {
        this.authService.saveTokens(res.accessToken, res.refreshToken);
      })
    );
  }

  logout(payload: ILogoutRequest): Observable<any> {
    return this.apiService.post('users/logout', payload, {
      withAuth: true,
      loading: true
    }).pipe(
      tap(() => {
        this.authService.clearTokens();
        this.router.navigate(['/login']);
      })
    );
  }
}
