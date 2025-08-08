import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminSettingComponent } from './admin-setting.component';
import { UserCandidatesComponent } from './pages/permissions/user-candidates/user-candidates.component';
import { UserWebComponent } from './pages/permissions/user-web/user-web.component';
import { ManagementUserComponent } from './pages/permissions/management-user/management-user.component';
import { JobPositionComponent } from './pages/data-setting/manpower/job-position/job-position.component';
import { ReasonRequestComponent } from './pages/data-setting/manpower/reason-request/reason-request.component';
import { WebPolicyComponent } from './pages/data-setting/application/web-policy/web-policy.component';
import { GeneralBenefitsComponent } from './pages/data-setting/application/general-benefits/general-benefits.component';
import { EmailTemplateComponent } from './pages/data-setting/application/email/email-template/email-template.component';
import { EmailAttributeComponent } from './pages/data-setting/application/email/email-attribute/email-attribute.component';

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
      {
        path: 'data-setting/manpower/job-position',
        component: JobPositionComponent
      },
      {
        path: 'data-setting/manpower/reason-request',
        component: ReasonRequestComponent
      },
      {
        path: 'data-setting/application/web-policy',
        component: WebPolicyComponent
      },
      {
        path: 'data-setting/application/general-benefits',
        component: GeneralBenefitsComponent
      },
      {
        path: 'data-setting/application/email/email-template',
        component: EmailTemplateComponent
      },
      {
        path: 'data-setting/application/email/email-attribute',
        component: EmailAttributeComponent
      },
    ],
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminSettingRoutingModule { }
