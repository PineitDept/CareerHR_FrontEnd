import { inject, Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, tap, finalize, map } from 'rxjs/operators';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private injector: Injector
  ) { }

  getAccessToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem('refresh_token');
  }

  saveTokens(access: string, refresh: string) {
    sessionStorage.setItem('access_token', access);
    sessionStorage.setItem('refresh_token', refresh);
  }

  clearTokens() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  }

  refreshToken(): Observable<string> {
    const apiService = this.injector.get(ApiService);
    const refreshToken = this.getRefreshToken();

    // (1) No refresh token → throw error immediately
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    // (2) If refresh is already in progress → wait for token from Subject
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(filter(token => token !== null), take(1));
    }

    // (3) Initiate a new token refresh
    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    // Send request to the users/refresh endpoint
    return apiService.post<{ accessToken: string }>('users/refresh', {
      refreshToken: this.getRefreshToken()
    }, {
      withAuth: false,
      loading: false
    }).pipe(
      tap(res => {
        this.saveTokens(res.accessToken, this.getRefreshToken()!); // Update the token
        this.refreshTokenSubject.next(res.accessToken); // Emit the token to waiting subscribers
      }),
      map(res => res.accessToken), // Convert the response to only a string
      catchError(err => {
        this.clearTokens();
        return throwError(() => err);
      }),
      finalize(() => this.isRefreshing = false)
    );
  }
}
