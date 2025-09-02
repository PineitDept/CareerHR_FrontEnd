import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { MatDialogModule } from '@angular/material/dialog';
import { QuillModule } from 'ngx-quill';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './pages/login/login.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { IndexComponent } from './pages/index/index.component';
import { ApiInterceptorFn } from './shared/interceptors/api/api.interceptor';
import { SharedModule } from './shared/shared.module';
import { ApplicationComponent } from './pages/application/application.component';
import { InterviewSchedulingComponent } from './pages/interview-scheduling/interview-scheduling.component';

export function quillInitFactory() {
  return () =>
    import('../quill-setup').then(m => m.setupQuillOnce());
}

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    MainLayoutComponent,
    AuthLayoutComponent,
    IndexComponent,
    ApplicationComponent,
    InterviewSchedulingComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot({
      positionClass: 'toast-top-right',
      timeOut: 3000,
      closeButton: true,
      progressBar: true
    }),
    MatDialogModule,
    SharedModule,
    FormsModule,
    QuillModule.forRoot()
  ],
  providers: [
    provideHttpClient(
      withInterceptors([ApiInterceptorFn])
    ),
    { provide: APP_INITIALIZER, useFactory: quillInitFactory, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
