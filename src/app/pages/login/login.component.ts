import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ILoginRequest } from '../../interfaces/login/login.interface';
import { LoginService } from '../../services/login/login.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../shared/services/notification/notification.service';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../shared/components/dialogs/alert-dialog/alert-dialog.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  loginForm!: FormGroup;
  passwordVisible: boolean = false;

  constructor(
    private loginService: LoginService,
    private fb: FormBuilder,
    private router: Router,
    private notificationService: NotificationService,
    private dialog: MatDialog,
  ) {
    const rememberedId = sessionStorage.getItem('remember_employee_id') || '';

    this.loginForm = this.fb.group({
      employeeId: [rememberedId, Validators.required],
      password: ['', Validators.required],
      rememberMe: [!!rememberedId]
    });
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  isInvalid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  openAlertDialog() {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '640px',
      panelClass: 'custom-dialog-container',
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Please contact the Human Resources Department',
        message: `For new registration or password reset, please contact our Human Resources Department for assistance.`,
        confirm: false
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { employeeId, password, rememberMe } = this.loginForm.value;

    const payload: ILoginRequest = {
      username: employeeId,
      password: password,
      rememberMe: rememberMe
    };
    // this.router.navigate(['index']);

    this.loginService.login(payload).subscribe({
      next: (res) => {
        // console.log('Login success', res);
        if (rememberMe) {
          sessionStorage.setItem('remember_employee_id', employeeId);
        } else {
          sessionStorage.removeItem('remember_employee_id');
        }
        this.router.navigate(['index']);
      },
      error: (err) => {
        // console.error('Login failed', err);
        switch (err?.type) {
          // case 'Unauthorized':
          //   this.notificationService.error('Employee ID or Password is invalid');
          //   break;

          // case 'NotFound':
          //   this.notificationService.error('User not found, please sign up');
          //   break;

          default:
            this.notificationService.error('Login failed, please try again');
            break;
        }
      }
    });

  }
}
