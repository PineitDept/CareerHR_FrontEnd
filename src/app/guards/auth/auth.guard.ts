import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';
import { AuthService } from '../../shared/services/auth/auth.service';

const REDIRECT_KEY = 'redirect_url';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    const token = this.authService.getAccessToken();

    // ✅ ถ้ามี token แล้ว ก็ผ่านได้เลย
    if (token) return true;

    // ✅ เช็กเฉพาะ path นี้เท่านั้น
    if (state.url.startsWith('/interview-scheduling/interview-form/review')) {
      // เก็บ URL เต็ม (รวม query) ไว้ใน sessionStorage
      sessionStorage.setItem(REDIRECT_KEY, state.url);

      // ส่งไปหน้า login พร้อมแนบ redirectUrl
      return this.router.createUrlTree(['/login'], {
        queryParams: { redirectUrl: state.url }
      });
    }

    // ✅ ถ้าเป็นหน้าอื่น → แค่ส่งไป login เฉย ๆ ไม่เก็บ redirect
    return this.router.createUrlTree(['/login']);
  }
}
