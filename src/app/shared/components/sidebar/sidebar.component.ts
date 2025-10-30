import { Component, HostListener, inject } from '@angular/core';
import { MenuItem } from '../../interfaces/menu/menu.interface';
import { LoginService } from '../../../services/login/login.service';
import { AuthService } from '../../services/auth/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../dialogs/alert-dialog/alert-dialog.component';
import { NotificationService } from '../../services/notification/notification.service';
import { NavigationEnd, Router, RouteReuseStrategy } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarService } from '../../services/sidebar/sidebar.service';
import { BOTTOM_MENU, MAIN_MENU, SUB_MENUS } from '../../constants/sidebar/sidebar.constants';
import { KeepAliveRouteStrategy } from '../../strategies/keep-alive-route.strategy';

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

  menuStack: string[] = [];
  saveStack: string[] = [];
  selectedByDepth: string[] = [];

  // Menu data
  mainMenu = MAIN_MENU;
  bottomMenu = BOTTOM_MENU;
  subMenus = SUB_MENUS;

  public router = inject(Router);
  private reuse = inject(RouteReuseStrategy) as KeepAliveRouteStrategy;

  constructor(
    public routers: Router,
    private loginService: LoginService,
    private authService: AuthService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private sidebarService: SidebarService
  ) { }

  @HostListener('window:resize')
  onResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile && !wasMobile) {
      this.isAutoCollapsed = true;
      this.isMobileSidebarVisible = false;
    } else if (!this.isMobile && wasMobile) {
      this.isAutoCollapsed = false;
    }
  }

  ngOnInit() {
    this.onResize();

    if (this.routers.url === '/index' || this.routers.url.startsWith('/index?')) {
      this.menuStack = [];
      this.selectedByDepth = [];
    } else {
      this.syncFromUrl(this.routers.url);
    }

    this.routers.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.syncFromUrl(e.urlAfterRedirects));
  }

  // --------------------- Drill-down computed ---------------------
  get rootMenus(): MenuItem[] {
    return this.mainMenu;
  }

  get currentNodes(): MenuItem[] {
    if (this.menuStack.length === 0) return this.rootMenus;

    let nodes: MenuItem[] | undefined = this.subMenus[this.menuStack[0]];

    for (let i = 1; i < this.menuStack.length; i++) {
      if (!nodes) break;
      const lbl = this.menuStack[i];
      const found = nodes.find((n: MenuItem) => n.label === lbl) as MenuItem | undefined;
      nodes = found?.children;
    }
    return nodes ?? [];
  }

  get isUnderAdmin(): boolean {
    return this.menuStack[0] === 'Admin Setting';
  }

  // --------------------- Click handlers ---------------------
  onRootClick(item: MenuItem, e?: MouseEvent) {
    e?.stopPropagation();
    if (item.label === 'Logout') return this.logout();

    const sub = this.subMenus[item.label];
    if (sub?.length) {
      this.selectedByDepth[0] = item.label;
      this.menuStack = [item.label];
      return;
    }
    if (item.path) {
      this.selectedByDepth[0] = item.label;
      this.navigateToSubPagePath(item.path);
      this.saveStack = [];
      this.saveStack = this.selectedByDepth;
    }
  }

  // node click (ระดับใดๆ)
  onNodeClick(node: MenuItem, e?: MouseEvent) {
    e?.stopPropagation();
    const depth = this.menuStack.length;
    if (node.children?.length) {
      this.selectedByDepth[depth] = node.label;
      this.menuStack.push(node.label);
      return;
    }
    if (node.path) {
      this.selectedByDepth[depth] = node.label;
      this.navigateToSubPagePath(node.path);
      this.saveStack = [];
      this.saveStack = this.selectedByDepth;
    }
  }

  backOneLevel() {
    if (this.menuStack.length > 0) this.menuStack.pop();
  }

  backToMainMenu() {
    this.menuStack = [];
  }

  navigateToSubPagePath(fullPath: string) {
    if (!fullPath) return;
    const segments = fullPath.split('/').filter(Boolean);
    this.routers.navigate(segments);
    this.reuse.clearAll();
  }

  // --------------------- helpers ---------------------
  isNodeActive(label: string): boolean {
    return this.menuStack.includes(label);
  }

  isLeafActive(path?: string): boolean {
    return !!path && this.routers.url.startsWith('/' + path);
  }

  isRouteActive(path?: string): boolean {
    return !!path && this.routers.url.startsWith('/' + path);
  }

  isNodeActiveAtDepth(depth: number, label: string): boolean {
    return this.saveStack[depth] === label;
  }

  isActiveForCurrentLevel(n: MenuItem): boolean {
    const depth = this.menuStack.length;
    return n.children?.length
      ? this.isNodeActiveAtDepth(depth, n.label)
      : this.isLeafActive(n.path);
  }

  hasRootChildren(label: string): boolean {
    return !!this.subMenus[label]?.length;
  }

  // --------------------- URL -> stack sync ---------------------
  private syncFromUrl(url: string) {
    if (url === '/index' || url.startsWith('/index?')) {
      this.menuStack = [];
      this.selectedByDepth = [];
      this.saveStack = [];
      return;
    }

    const chain = this.findFullLabelChainByUrl(url);
    if (chain) {
      this.menuStack = chain.slice(0, -1);
      this.saveStack = [];
      for (let i = 0; i < chain.length; i++) {
        this.saveStack[i] = chain[i];
      }
    }
  }

  private findFullLabelChainByUrl(url: string): string[] | null {
    const dfs = (nodes: MenuItem[], chain: string[]): string[] | null => {
      for (const n of nodes) {
        const chainPlus = [...chain, n.label];
        if (n.path && url.startsWith('/' + n.path)) {
          return chainPlus;
        }
        if (n.children?.length) {
          const hit = dfs(n.children, chainPlus);
          if (hit) return hit;
        }
      }
      return null;
    };

    const roots = [...this.mainMenu, ...this.bottomMenu];
    for (const r of roots) {
      const sub = this.subMenus[r.label];
      if (!sub?.length) continue;
      const hit = dfs(sub, [r.label]);
      if (hit) return hit;
    }
    return null;
  }


  // --------------------- UI misc ---------------------
  toggleSidebar() {
    if (this.isMobile) this.isMobileSidebarVisible = !this.isMobileSidebarVisible;
    else this.isUserCollapsed = !this.isUserCollapsed;
  }

  get isCollapsed(): boolean {
    return this.isUserCollapsed || this.isAutoCollapsed;
  }

  get isExpanded(): boolean {
    return (!this.isCollapsed && !this.isMobile) || (this.isMobile && this.isMobileSidebarVisible);
  }

  get sidebarWidth(): string {
    const width = this.isExpanded ? '240px' : '60px';
    this.sidebarService.setSidebarWidth(width);
    return width;
  }

  get menuLabelClass(): string {
    return [
      'tw-inline-block',
      'tw-transition-all',
      'tw-duration-300',
      'tw-ease-in-out',
      'tw-whitespace-nowrap',
      'tw-min-w-0',
      this.isExpanded
        ? 'tw-opacity-100 tw-scale-100 tw-flex-1'
        : 'tw-opacity-0 tw-scale-95 tw-w-0 tw-overflow-hidden tw-pointer-events-none'
    ].join(' ');
  }

  // --------------------- Logout ---------------------
  logout(): void {
    Promise.resolve().then(() => {
      document.querySelector('.cdk-overlay-container')?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '400px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Logout Confirmation',
        message: 'Are you sure you want to logout?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      document.querySelector('.cdk-overlay-container')?.classList.remove('dimmed-overlay');
      if (!confirmed) return;

      this.loginService.logout().subscribe({
        next: () => { },
        error: () => this.notificationService.error('Logout failed, please try again')
      });
    });
  }
}
