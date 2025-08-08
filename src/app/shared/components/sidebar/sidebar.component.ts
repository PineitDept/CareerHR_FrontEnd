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

  adminSettingSubMenu: string = '';
  dataSettingSubMenu: string = '';

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
    if (url.startsWith('/admin-setting/permissions')) {
      this.activeMainMenu = 'Admin Setting';
      return;
    }

    if (url.startsWith('/admin-setting/data-setting')) {
      this.activeMainMenu = 'Admin Setting';
      this.adminSettingSubMenu = 'Data Setting';
      this.expandedNestedMenus.add('Data Setting'); // ขยาย Data Setting

      // ตรวจสอบเส้นทางของ Manpower และ Application ใน Data Setting
      if (url.startsWith('/admin-setting/data-setting/manpower')) {
        this.expandedNestedMenus.add('Manpower');  // ขยาย Manpower
      } else if (url.startsWith('/admin-setting/data-setting/application')) {
        this.dataSettingSubMenu = 'Application';
        this.expandedNestedMenus.add('Application');  // ขยาย Application

        if (url.startsWith('/admin-setting/data-setting/application/email')) {
          this.expandedNestedMenus.add('Email');  // ขยาย Email
        }
      }
      return;
    }

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

  isAdminSettingActive(): boolean {
    const currentUrl = this.router.url;

    // เช็คว่า URL เริ่มต้นด้วย '/admin-setting' หรือไม่
    if (currentUrl.startsWith('/admin-setting')) {
      return true;
    }

    // ตรวจสอบว่า Data Setting หรือ sub-menu ของมันถูก active อยู่
    const dataSettingMenu = this.subMenus['Admin Setting'].find(menu => menu.label === 'Data Setting');
    if (dataSettingMenu && dataSettingMenu.children) {
      // ตรวจสอบ path ของ children ว่ามี path ใดที่ตรงกับ URL ปัจจุบัน
      const isDataSettingActive = dataSettingMenu.children.some(child => currentUrl.startsWith('/' + child.path));
      if (isDataSettingActive) {
        return true;
      }
    }

    return false;
}


  onMainMenuClick(label: string) {
    if (label === 'Admin Setting') {
      this.activeMainMenu = label;
      this.adminSettingSubMenu = '';
    } else {
      this.activeMainMenu = label;
    }
    this.expandMenuIfChildActive();
  }

  expandMenuIfChildActive() {
    const subMenu = this.subMenus[this.activeMainMenu];
    if (!subMenu) return;

    // ตรวจสอบว่า path ของ Manpower ถูกเปิดอยู่หรือไม่
    const isManpowerActive = this.isRouteActive('admin-setting/data-setting/manpower');
    const isApplicationActive = this.isRouteActive('admin-setting/data-setting/application');
    const isEmailActive = this.isRouteActive('admin-setting/data-setting/application/email');

    // ถ้า path ของ Manpower หรือ Application ถูกเปิดอยู่ เราก็ขยายเมนูที่เกี่ยวข้อง
    if (isManpowerActive) {
      this.expandedNestedMenus.add('Manpower');
    } else if (isApplicationActive) {
      this.expandedNestedMenus.add('Application');
      if (isEmailActive) {
        this.expandedNestedMenus.add('Email');
      }
    }

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
    this.adminSettingSubMenu = ''; // รีเซ็ตเมื่อกลับไปที่ Main Menu
    this.dataSettingSubMenu = ''; // รีเซ็ตเมื่อกลับไปที่ Main Menu
    this.expandedNestedMenus.clear();
  }

  backToSubMenu() {
    if (this.dataSettingSubMenu) {
      this.dataSettingSubMenu = '';
    } else {
      this.adminSettingSubMenu = '';
    }
    this.expandedNestedMenus.clear();
    this.expandMenuIfChildActive();
  }

  toggleNested(menu: string) {
    if (this.expandedNestedMenus.has(menu)) {
      this.expandedNestedMenus.delete(menu);
    } else {
      this.expandedNestedMenus.add(menu);

      if (this.activeMainMenu === 'Admin Setting') {
        if (menu === 'Data Setting') {
          this.adminSettingSubMenu = 'Data Setting';
          this.dataSettingSubMenu = ''; // รีเซ็ตค่า dataSettingSubMenu เมื่อกลับไปยัง Data Setting
        } else if (menu === 'Application') {
          this.dataSettingSubMenu = 'Application';  // กำหนดว่า Application ถูกเลือก
        }
      }
    }
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
      width = '240px';
      // const screenWidth = window.innerWidth;
      // if (screenWidth >= 1280) {
      //   width = '240px';
      // } else {
      //   width = '190px';
      // }
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

  get dataSettingChildren(): MenuItem[] {
    const adminSetting = this.subMenus['Admin Setting'];
    const dataSetting = adminSetting?.find(item => item.label === 'Data Setting');
    return dataSetting?.children ?? [];
  }

  get applicationSettingChildren(): MenuItem[] {
    const adminSetting = this.subMenus['Admin Setting'];
    const dataSetting = adminSetting?.find(item => item.label === 'Data Setting');
    const applicationMenu = dataSetting?.children?.find(item => item.label === 'Application');
    return applicationMenu?.children ?? [];
  }

  // Menu Data
  mainMenu: MenuItem[] = [
    { label: 'Manpower', icon: 'user', path: 'manpower' },
    { label: 'Applications Form', icon: 'hand-taking-user', path: 'applications' },
    // { label: 'Tools', icon: 'box-archive' },
  ];

  bottomMenu: MenuItem[] = [
    { label: 'Admin Setting', icon: 'gear' },
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
    'Admin Setting': [
      {
        label: 'Permissions',
        icon: 'shield',
        children: [
          { label: 'User Candidates', icon: 'star-fat', path: 'admin-setting/permissions/user-candidates' },
          { label: 'User Web', icon: 'user-multiple', path: 'admin-setting/permissions/user-web' },
          { label: 'Management User', icon: 'crown', path: 'admin-setting/permissions/management-user' },
        ]
      },
      {
        label: 'Data Setting',
        icon: 'sliders-horizontal-square',
        children: [
          {
            label: 'Manpower',
            icon: 'user',
            children: [
              { label: 'Job Position', icon: 'target-user', path: 'admin-setting/data-setting/manpower/job-position' },
              { label: 'Reason Request', icon: 'pen-to-square', path: 'admin-setting/data-setting/manpower/reason-request' },
            ]
          },
          {
            label: 'Application',
            icon: 'hand-taking-user',
            children: [
              { label: 'Web Policy', icon: 'bookmark', path: 'admin-setting/data-setting/application/web-policy' },
              { label: 'General Benefits', icon: 'star-fat-half', path: 'admin-setting/data-setting/application/general-benefits' },
              { label: 'Special Benefits', icon: 'badge-decagram-percent', path: 'admin-setting/data-setting/application/special-benefits' },
              { label: 'University', icon: 'graduation-cap', path: 'admin-setting/data-setting/application/university' },
              { label: 'Computer Skills', icon: 'code', path: 'admin-setting/data-setting/application/computer-skills' },
              { label: 'Language Skills', icon: 'bulb', path: 'admin-setting/data-setting/application/language-skills' },
              { label: 'Reason', icon: 'menu-cheesburger', path: 'admin-setting/data-setting/application/reason' },
              { label: 'Application Question', icon: 'file-question', path: 'admin-setting/data-setting/application/application-question' },
              {
                label: 'Email',
                icon: 'mail',
                children: [
                  { label: 'Email Template', icon: 'text-paragraph', path: 'admin-setting/data-setting/application/email/email-template' },
                  { label: 'Email Attribute', icon: 'clipboard', path: 'admin-setting/data-setting/application/email/email-attribute' }
                ]
              },
              { label: 'Score', icon: 'bar-chart', path: 'admin-setting/data-setting/application/score' },
            ]
          }
        ]
      }
    ],
  };
}
