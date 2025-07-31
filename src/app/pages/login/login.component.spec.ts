import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LoginService } from '../../services/login/login.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../shared/services/notification/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { ILoginResponse } from '../../interfaces/login/login.interface';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let loginService: jasmine.SpyObj<LoginService>;
  let router: jasmine.SpyObj<Router>;
  let notifier: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    loginService = jasmine.createSpyObj('LoginService', ['login']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    notifier = jasmine.createSpyObj('NotificationService', ['error']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, FormsModule, MatDialogModule],
      declarations: [LoginComponent],
      providers: [
        { provide: LoginService, useValue: loginService },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notifier },
        { provide: MatDialog, useValue: dialog }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create LoginComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should mark form controls as touched if form is invalid', () => {
    component.loginForm.get('employeeId')?.setValue('');
    component.loginForm.get('password')?.setValue('');
    component.onSubmit();
    expect(component.loginForm.touched).toBeTrue();
    expect(component.loginForm.get('employeeId')?.touched).toBeTrue();
    expect(component.loginForm.get('password')?.touched).toBeTrue();
  });

  it('should call login and navigate to index on success (rememberMe: true)', () => {
    const mockResponse: ILoginResponse = { accessToken: 'token1', refreshToken: 'token2' };
    component.loginForm.setValue({ employeeId: 'emp01', password: 'pass', rememberMe: true });
    loginService.login.and.returnValue(of(mockResponse));

    component.onSubmit();

    expect(loginService.login).toHaveBeenCalledWith({ emp_id: 'emp01', password: 'pass' });
    expect(sessionStorage.getItem('remember_employee_id')).toBe('emp01');
    expect(router.navigate).toHaveBeenCalledWith(['index']);
  });

  it('should call login and navigate to index on success (rememberMe: false)', () => {
    const mockResponse: ILoginResponse = { accessToken: 'token3', refreshToken: 'token4' };
    component.loginForm.setValue({ employeeId: 'emp04', password: 'pass', rememberMe: false });
    loginService.login.and.returnValue(of(mockResponse));

    component.onSubmit();

    expect(loginService.login).toHaveBeenCalledWith({ emp_id: 'emp04', password: 'pass' });
    expect(sessionStorage.getItem('remember_employee_id')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['index']);
  });

  it('should remove remember_employee_id if rememberMe is false', () => {
    sessionStorage.setItem('remember_employee_id', 'emp01');
    const mockResponse: ILoginResponse = { accessToken: 't', refreshToken: 'r' };
    component.loginForm.setValue({ employeeId: 'emp02', password: 'pass', rememberMe: false });
    loginService.login.and.returnValue(of(mockResponse));

    component.onSubmit();

    expect(sessionStorage.getItem('remember_employee_id')).toBeNull();
  });

  it('should show Unauthorized error', () => {
    component.loginForm.setValue({ employeeId: 'u1', password: 'wrong', rememberMe: false });
    loginService.login.and.returnValue(throwError(() => ({ type: 'Unauthorized' })));

    component.onSubmit();

    expect(notifier.error).toHaveBeenCalledWith('Employee ID or Password is invalid');
  });

  it('should show NotFound error', () => {
    component.loginForm.setValue({ employeeId: 'u1', password: 'none', rememberMe: false });
    loginService.login.and.returnValue(throwError(() => ({ type: 'NotFound' })));

    component.onSubmit();

    expect(notifier.error).toHaveBeenCalledWith('User not found, please sign up');
  });

  it('should show default error', () => {
    component.loginForm.setValue({ employeeId: 'u1', password: 'none', rememberMe: false });
    loginService.login.and.returnValue(throwError(() => ({ type: 'SomethingElse' })));

    component.onSubmit();

    expect(notifier.error).toHaveBeenCalledWith('Login failed, please try again');
  });

  it('should toggle password visibility', () => {
    expect(component.passwordVisible).toBeFalse();
    component.togglePasswordVisibility();
    expect(component.passwordVisible).toBeTrue();
    component.togglePasswordVisibility();
    expect(component.passwordVisible).toBeFalse();
  });

  it('should open alert dialog and add/remove overlay dimmed class', fakeAsync(() => {
    const mockDialogRef = {
      afterClosed: () => of(true)
    };
    dialog.open.and.returnValue(mockDialogRef as any);

    spyOn(document, 'querySelector').and.callFake((selector: string) => {
      return {
        classList: {
          add: jasmine.createSpy('add'),
          remove: jasmine.createSpy('remove')
        }
      } as any;
    });

    component.openAlertDialog();
    tick();

    expect(dialog.open).toHaveBeenCalled();
  }));
});
