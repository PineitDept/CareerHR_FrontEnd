import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';
import { Router, NavigationEnd } from '@angular/router';
import { of, Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { SidebarService } from '../../services/sidebar/sidebar.service';
import { AuthService } from '../../services/auth/auth.service';
import { LoginService } from '../../../services/login/login.service';
import { NotificationService } from '../../services/notification/notification.service';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: '',
})
class MockIconComponent {
  @Input() name: string = '';
  @Input() size: number = 24;
  @Input() fill: string = '';
  @Input() extraClass: string = '';
}

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  let routerEvents$: Subject<any>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockLoginService: any;
  let mockAuthService: any;
  let mockDialog: any;
  let mockNotificationService: any;
  let mockSidebarService: any;

  beforeEach(async () => {
    routerEvents$ = new Subject();

    mockRouter = jasmine.createSpyObj('Router', ['navigate'], {
      events: routerEvents$.asObservable(),
      url: '/asset/list/active'
    });

    mockLoginService = {
      logout: jasmine.createSpy().and.returnValue(of({}))
    };

    mockAuthService = {
      getRefreshToken: jasmine.createSpy().and.returnValue('mockRefreshToken')
    };

    mockDialog = {
      open: jasmine.createSpy().and.returnValue({
        afterClosed: () => of(true)
      })
    };

    mockNotificationService = {
      error: jasmine.createSpy()
    };

    mockSidebarService = {
      setSidebarWidth: jasmine.createSpy()
    };

    await TestBed.configureTestingModule({
      declarations: [SidebarComponent, MockIconComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: LoginService, useValue: mockLoginService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: SidebarService, useValue: mockSidebarService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create SidebarComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should detect mobile on resize < 768', () => {
    spyOnProperty(window, 'innerWidth').and.returnValue(600);
    component.onResize();
    expect(component.isMobile).toBeTrue();
    expect(component.isAutoCollapsed).toBeTrue();
    expect(component.isMobileSidebarVisible).toBeFalse();
  });

  it('should detect desktop on resize > 768', () => {
    component.isMobile = true;
    spyOnProperty(window, 'innerWidth').and.returnValue(1200);
    component.onResize();
    expect(component.isMobile).toBeFalse();
    expect(component.isAutoCollapsed).toBeFalse();
  });

  it('should set active menu from URL', () => {
    component.setActiveMenuFromUrl('/purchasing/purchase-order');
    expect(component.activeMainMenu).toBe('Purchasing');
  });

  it('should return true if route is active', () => {
    expect(component.isRouteActive('asset')).toBeTrue();
  });

  it('should handle menu click and expand child if active', () => {
    component.onMainMenuClick('Asset');
    expect(component.activeMainMenu).toBe('Asset');
  });

  it('should expand nested menu if child route is active', () => {
    Object.defineProperty(mockRouter, 'url', { value: '/asset/list/active' });
    component.activeMainMenu = 'Asset';
    component.expandMenuIfChildActive();
    expect(component.expandedNestedMenus.has('Asset List')).toBeTrue();
  });

  it('should navigate to full path segments', () => {
    component.navigateToSubPagePath('asset/list/active');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['asset', 'list', 'active']);
  });

  it('should toggle sidebar for desktop', () => {
    component.isMobile = false;
    component.isUserCollapsed = false;
    component.toggleSidebar();
    expect(component.isUserCollapsed).toBeTrue();
  });

  it('should toggle sidebar for mobile', () => {
    component.isMobile = true;
    component.isMobileSidebarVisible = false;
    component.toggleSidebar();
    expect(component.isMobileSidebarVisible).toBeTrue();
  });

  it('should clear active menu and collapse all', () => {
    component.activeMainMenu = 'Asset';
    component.expandedNestedMenus.add('SomeMenu');
    component.backToMainMenu();
    expect(component.activeMainMenu).toBe('');
    expect(component.expandedNestedMenus.size).toBe(0);
  });

  it('should toggle nested menu', () => {
    const menu = 'Asset List';

    component.expandedNestedMenus.delete(menu);
    expect(component.expandedNestedMenus.has(menu)).toBeFalse();

    component.toggleNested(menu);
    expect(component.expandedNestedMenus.has(menu)).toBeTrue();

    component.toggleNested(menu);
    expect(component.expandedNestedMenus.has(menu)).toBeFalse();
  });

  it('should return correct isCollapsed and isExpanded state', () => {
    component.isUserCollapsed = true;
    expect(component.isCollapsed).toBeTrue();
    component.isUserCollapsed = false;
    component.isAutoCollapsed = true;
    expect(component.isCollapsed).toBeTrue();

    component.isAutoCollapsed = false;
    component.isMobile = true;
    component.isMobileSidebarVisible = true;
    expect(component.isExpanded).toBeTrue();
  });

  it('should return correct sidebar width and call sidebarService', () => {
    spyOnProperty(window, 'innerWidth').and.returnValue(1440);
    const width = component.sidebarWidth;
    expect(width).toBe('300px');
    expect(mockSidebarService.setSidebarWidth).toHaveBeenCalledWith('300px');
  });

  it('should return correct label class when showLabel is true', () => {
    spyOnProperty(component, 'showLabel', 'get').and.returnValue(true);
    expect(component.menuLabelClass).toContain('tw-opacity-100');
  });

  it('should return correct label class when showLabel is false', () => {
    spyOnProperty(component, 'showLabel', 'get').and.returnValue(false);
    expect(component.menuLabelClass).toContain('tw-opacity-0');
  });

  it('should logout successfully', fakeAsync(() => {
    const overlay = document.createElement('div');
    overlay.classList.add('cdk-overlay-container');
    document.body.appendChild(overlay);

    component.logout();
    tick();
    expect(mockDialog.open).toHaveBeenCalled();
    tick();
    expect(mockLoginService.logout).toHaveBeenCalledWith({
      refreshToken: 'mockRefreshToken'
    });

    document.body.removeChild(overlay);
  }));

  it('should show error if refresh token not found', fakeAsync(() => {
    mockAuthService.getRefreshToken.and.returnValue(null);
    mockDialog.open.and.returnValue({
      afterClosed: () => of(true)
    });

    component.logout();
    tick();
    expect(mockLoginService.logout).not.toHaveBeenCalled();
  }));

  it('should show error if logout fails', fakeAsync(() => {
    mockLoginService.logout = jasmine.createSpy().and.returnValue({
      subscribe: ({ error }: any) => error({ type: 'error' })
    });

    component.logout();
    tick();
    expect(mockNotificationService.error).toHaveBeenCalled();
  }));

  it('should update active menu on router NavigationEnd', fakeAsync(() => {
    routerEvents$.next(new NavigationEnd(1, '/old', '/asset/list/active'));
    tick();
    expect(component.activeMainMenu).toBe('Asset');
  }));
});
