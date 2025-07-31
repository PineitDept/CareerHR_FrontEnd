import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { ToastrService } from 'ngx-toastr';

describe('NotificationService', () => {
  let service: NotificationService;
  let toastrSpy: jasmine.SpyObj<ToastrService>;

  beforeEach(() => {
    toastrSpy = jasmine.createSpyObj('ToastrService', ['success', 'error', 'info', 'warning']);

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: ToastrService, useValue: toastrSpy }
      ]
    });

    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show success toast when message is new', fakeAsync(() => {
    service.success('Operation completed');
    tick(3000); // Wait for the timer to finish
    expect(toastrSpy.success).toHaveBeenCalledWith('Operation completed', 'Success');
  }));

  it('should not show duplicate success toast within 3 seconds', fakeAsync(() => {
    service.success('Duplicated');
    service.success('Duplicated');
    tick(3000); // Wait for the timer to be cleared
    expect(toastrSpy.success).toHaveBeenCalledTimes(1);
  }));

  it('should allow same success toast after 3 seconds', fakeAsync(() => {
    service.success('OK');
    tick(3000); // clear cache
    service.success('OK');
    tick(3000); // Clear again (2nd round)
    expect(toastrSpy.success).toHaveBeenCalledTimes(2);
  }));

  it('should show error toast when message is new', fakeAsync(() => {
    service.error('Something failed');
    tick(3000);
    expect(toastrSpy.error).toHaveBeenCalledWith('Something failed', 'Error');
  }));

  it('should not show duplicate error toast within 3 seconds', fakeAsync(() => {
    service.error('Server down');
    service.error('Server down');
    tick(3000);
    expect(toastrSpy.error).toHaveBeenCalledTimes(1);
  }));

  it('should allow same error toast after 3 seconds', fakeAsync(() => {
    service.error('Try again');
    tick(3000);
    service.error('Try again');
    tick(3000);
    expect(toastrSpy.error).toHaveBeenCalledTimes(2);
  }));

  it('should show info toast when message is new', fakeAsync(() => {
    service.info('Information');
    tick(3000);
    expect(toastrSpy.info).toHaveBeenCalledWith('Information', 'Info');
  }));

  it('should show warn toast when message is new', fakeAsync(() => {
    service.warn('Be careful');
    tick(3000);
    expect(toastrSpy.warning).toHaveBeenCalledWith('Be careful', 'Warning');
  }));
});
