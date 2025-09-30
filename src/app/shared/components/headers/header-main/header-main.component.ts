import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-header-main',
  templateUrl: './header-main.component.html',
  styleUrl: './header-main.component.scss'
})
export class HeaderMainComponent {

  currentUser: string | undefined;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      this.currentUser = user.username;
    }
  }

  handleLogoClick() {
    const token = this.authService.getAccessToken();
    if (token) {
      this.router.navigate(['/index']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
