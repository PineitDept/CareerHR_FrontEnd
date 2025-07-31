import { TestBed } from '@angular/core/testing';
import { SidebarService } from './sidebar.service';

describe('SidebarService', () => {
  let service: SidebarService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidebarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return default width if none is set', () => {
    // Skip setting sessionStorage
    const width = service.getSidebarWidth();
    expect(width).toBe(190); // parseInt('190px', 10) = 190
  });

  it('should return stored width if set', () => {
    sessionStorage.setItem('sidebarWidth', '250px');
    const newService = TestBed.inject(SidebarService); // So values will be freshly loaded
    expect(newService.getSidebarWidth()).toBe(250);
  });

  it('should update sidebar width and persist to sessionStorage', () => {
    service.setSidebarWidth('300px');
    expect(sessionStorage.getItem('sidebarWidth')).toBe('300px');
    expect(service.getSidebarWidth()).toBe(300);
  });

  it('should emit new width via sidebarWidth$', (done) => {
    service.setSidebarWidth('280px');
    service.sidebarWidth$.subscribe(value => {
      expect(value).toBe(280);
      done();
    });
  });

  it('should emit initial width from sessionStorage', (done) => {
    sessionStorage.setItem('sidebarWidth', '220px');
    // Recreate TestBed to trigger real dependency reinjection
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(SidebarService);

    newService.sidebarWidth$.subscribe(width => {
      expect(width).toBe(220);
      done();
    });
  });
});
