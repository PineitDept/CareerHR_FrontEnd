import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { RedirectService } from '../../services/redirect/redirect.service';
import { NotificationService } from '../../services/notification/notification.service';
import { WITH_AUTH } from '../../interfaces/api/api-request-options.interface';

export const ApiInterceptorFn: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const auth = inject(AuthService); // 1. Auth token logic
  const redirect = inject(RedirectService); // 2. For redirecting to login
  const notification = inject(NotificationService); // 3. For showing error message
  const withAuth = req.context.get(WITH_AUTH); // 4. Explicit opt-in/out of auth
  const accessToken = auth.getAccessToken(); // 5. Get token from sessionStorage

  // 6. If withAuth = true AND token exists → attach Authorization header
 const modifiedReq = withAuth && accessToken
  ? req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` },
      withCredentials: true, //  เพิ่มตรงนี้
    })
  : req.clone({ withCredentials: true }); //  ส่ง cookie ทุกกรณี

  return next(modifiedReq).pipe(
    catchError((error: any) => {
      // 7. Handle 401 Unauthorized + withAuth=true
      if (error instanceof HttpErrorResponse && error.status === 401 && withAuth) {
        return auth.refreshToken().pipe(
          switchMap((newToken) => {
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retryReq); // 8. Retry with new token
          }),
          catchError((refreshErr) => {
            // 9. If token refresh fails
            auth.clearTokens();
            notification.error('Session expired, please log in again.');
            redirect.redirectToLogin();
            return throwError(() => refreshErr); // 10. Other errors → passthrough
          })
        );
      }

      return throwError(() => error);
    })
  );
};
