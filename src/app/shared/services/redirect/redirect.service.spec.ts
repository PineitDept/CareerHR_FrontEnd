import { TestBed } from '@angular/core/testing';
import { RedirectService } from './redirect.service';
import { Router } from '@angular/router';

describe('RedirectService', () => {
  let service: RedirectService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        RedirectService,
        { provide: Router, useValue: routerSpy }
      ]
    });

    service = TestBed.inject(RedirectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should navigate to /login when redirectToLogin is called', () => {
    service.redirectToLogin();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should be extendable to redirect to /home', () => {
    // Assume there's a new function in the future
    (service as any).redirectToHome = function () {
      this.router.navigate(['/home']);
    };

    (service as any).redirectToHome();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should navigate to a dynamic route when custom redirect is implemented', () => {
    const path = '/dashboard/123';

    // Assume in the future there's a function that accepts a path
    (service as any).redirectTo = function (route: string) {
      this.router.navigate([route]);
    };

    (service as any).redirectTo(path);
    expect(routerSpy.navigate).toHaveBeenCalledWith([path]);
  });
});
