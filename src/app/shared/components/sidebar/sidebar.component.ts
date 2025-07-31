import { Component, HostListener } from '@angular/core';
import { MenuItem } from '../../interfaces/menu/menu.interface';
import { LoginService } from '../../../services/login/login.service';
import { AuthService } from '../../services/auth/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../dialogs/alert-dialog/alert-dialog.component';
import { NotificationService } from '../../services/notification/notification.service';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarService } from '../../services/sidebar/sidebar.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {

  isMobile = false;
  isMobileSidebarVisible = false;

  isUserCollapsed = false;
  isAutoCollapsed = false;

  activeMainMenu = '';
  expandedNestedMenus: Set<string> = new Set();

  constructor(
    public router: Router,
    private loginService: LoginService,
    private authService: AuthService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private sidebarService: SidebarService
  ) { }

  @HostListener('window:resize')
  onResize() {
    const wasMobile = this.isMobile;
    const width = window.innerWidth;

    this.isMobile = width < 768;

    if (this.isMobile && !wasMobile) {
      this.isAutoCollapsed = true;
      this.isMobileSidebarVisible = false;
    } else if (!this.isMobile && wasMobile) {
      this.isAutoCollapsed = false;
    }
  }

  ngOnInit() {
    this.onResize();

    this.setActiveMenuFromUrl(this.router.url);
    this.expandMenuIfChildActive();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.setActiveMenuFromUrl(event.urlAfterRedirects);
      this.expandMenuIfChildActive();
    });
  }

 setActiveMenuFromUrl(url: string) {
  for (const main of this.mainMenu) {
    const subMenu = this.subMenus[main.label];
    if (!subMenu) continue;

    for (const item of subMenu) {
      // ตรวจ path หลัก
      if (item.path && url.startsWith('/' + item.path)) {
        this.activeMainMenu = main.label;
        return;
      }

      // ตรวจ nested path
      if (item.children) {
        for (const child of item.children) {
          if (child.path && url.startsWith('/' + child.path)) {
            this.activeMainMenu = main.label;
            return;
          }
        }
      }
    }
  }

  // ถ้าไม่ match อะไรเลย
  this.activeMainMenu = '';
}
  isRouteActive(path: string): boolean {
    return this.router.url.startsWith(`/${path}`);
  }

  onMainMenuClick(label: string) {
    this.activeMainMenu = label;
    this.expandMenuIfChildActive()
  }

  expandMenuIfChildActive() {
    const subMenu = this.subMenus[this.activeMainMenu];
    if (!subMenu) return;

    for (const item of subMenu) {
      if (item.children) {
        for (const child of item.children) {
          if (child.path && this.isRouteActive(child.path)) {
            this.expandedNestedMenus.add(item.label);
          }
        }
      }
    }
  }

  navigateToSubPagePath(fullPath: string) {
    const pathSegments = fullPath.split('/');
    this.router.navigate(pathSegments);
  }

  toggleSidebar() {
    if (this.isMobile) {
      this.isMobileSidebarVisible = !this.isMobileSidebarVisible;
    } else {
      this.isUserCollapsed = !this.isUserCollapsed;
    }
  }

  backToMainMenu() {
    this.activeMainMenu = '';
    this.expandedNestedMenus.clear();
  }

  toggleNested(menu: string) {
    this.expandedNestedMenus.has(menu)
      ? this.expandedNestedMenus.delete(menu)
      : this.expandedNestedMenus.add(menu);
  }

  get isCollapsed(): boolean {
    return this.isUserCollapsed || this.isAutoCollapsed;
  }

  get isExpanded(): boolean {
    return (!this.isCollapsed && !this.isMobile) || (this.isMobile && this.isMobileSidebarVisible);
  }

  get sidebarWidth(): string {
    let width: string;

    if (!this.isExpanded) {
      width = '60px';
    } else {
      const screenWidth = window.innerWidth;
      if (screenWidth >= 1280) {
        width = '240px';
      } else {
        width = '190px';
      }
    }

    this.sidebarService.setSidebarWidth(width);
    return width;
  }

  get showLabel(): boolean {
    return this.isExpanded;
  }

  get menuLabelClass(): string {
    return [
      'tw-inline-block',
      'tw-transition-all',
      'tw-duration-300',
      'tw-ease-in-out',
      'tw-whitespace-nowrap',
      'tw-min-w-0',
      this.showLabel
        ? 'tw-opacity-100 tw-scale-100 tw-flex-1'
        : 'tw-opacity-0 tw-scale-95 tw-w-0 tw-overflow-hidden tw-pointer-events-none'
    ].join(' ');
  }

  logout(): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '400px',
      panelClass: 'custom-dialog-container',
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Logout Confirmation',
        message: 'Are you sure you want to logout?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {

      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!confirmed) return;

      const refreshToken = this.authService.getRefreshToken();
      if (!refreshToken) return;

      this.loginService.logout({ refreshToken }).subscribe({
        next: () => {
          // already navigated to /login
        },
        error: err => {
          // console.error('Logout failed:', err);
          switch (err?.type) {
            default:
              this.notificationService.error('Logout failed, please try again');
              break;
          }
        }
      });
    });

  }

  // Menu Data
  mainMenu: MenuItem[] = [
    { label: 'Manpower', icon: 'user' },
    { label: 'Applications Form', icon: 'dollar-circle' },
    // { label: 'Tools', icon: 'box-archive' },
  ];

  bottomMenu: MenuItem[] = [
    // { label: 'Admin Setting', icon: 'gear' },
    { label: 'Logout', icon: 'exit' },
  ];

  subMenus: { [key: string]: MenuItem[] } = {
    'Manpower': [
      { label: 'Position Request', icon: 'pen-to-square', path: 'manpower/position-request' },
      { label: 'Manpower Planning', icon: 'ruler-pen', path: 'manpower/manpower-planning' },
      { label: 'Status Overview', icon: 'trend-up', path: 'manpower/status-overview' },
    ],
    'Applications Form': [
      { label: 'All Applications', icon: 'notebook', path: 'applications/all-applications' },
      { label: 'Application Screening', icon: 'search-plus', path: 'applications/screening' },
      { label: 'Application Tracking', icon: 'route', path: 'applications/tracking' },
    ],
  };
}
