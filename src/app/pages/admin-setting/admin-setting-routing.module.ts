import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminSettingComponent } from './admin-setting.component';
import { UserCandidatesComponent } from './pages/user-candidates/user-candidates.component';
import { UserWebComponent } from './pages/user-web/user-web.component';
import { ManagementUserComponent } from './pages/management-user/management-user.component';

const routes: Routes = [
  {
    path: '',
    component: AdminSettingComponent,
    children: [
      {
        path: 'permissions/user-candidates',
        component: UserCandidatesComponent
      },
      {
        path: 'permissions/user-web',
        component: UserWebComponent
      },
      {
        path: 'permissions/management-user',
        component: ManagementUserComponent
      },
    ],
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminSettingRoutingModule { }
