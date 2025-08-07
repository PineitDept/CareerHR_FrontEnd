import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSettingComponent } from './admin-setting.component';
import { AdminSettingRoutingModule } from './admin-setting-routing.module';
import { UserCandidatesComponent } from './pages/user-candidates/user-candidates.component';
import { UserWebComponent } from './pages/user-web/user-web.component';
import { ManagementUserComponent } from './pages/management-user/management-user.component';

@NgModule({
  declarations: [
    AdminSettingComponent,
    UserCandidatesComponent,
    UserWebComponent,
    ManagementUserComponent
  ],
  imports: [
    CommonModule,
    AdminSettingRoutingModule
  ]
})
export class AdminSettingModule { }
