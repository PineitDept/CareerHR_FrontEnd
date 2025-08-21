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
import { ApplicationQuestionComponent } from './pages/data-setting/application/application-question/application-question.component';
import { ApplicationQuestionDetailsComponent } from './pages/data-setting/application/application-question/pages/application-question-details/application-question-details.component';
import { SpecialBenefitsComponent } from './pages/data-setting/application/special-benefits/special-benefits.component';
import { ComputerSkillsComponent } from './pages/data-setting/application/computer-skills/computer-skills.component';
import { LanguageSkillsComponent } from './pages/data-setting/application/language-skills/language-skills.component';
import { UniversityComponent } from './pages/data-setting/application/university/university.component';
import { EmailTemplateDetailsComponent } from './pages/data-setting/application/email/email-template/pages/email-template-details/email-template-details.component';

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
        path: 'data-setting/application/application-question',
        component: ApplicationQuestionComponent
      },
      {
        path: 'data-setting/application/application-question/details',
        component: ApplicationQuestionDetailsComponent
      },
      {
        path: 'data-setting/application/special-benefits',
        component: SpecialBenefitsComponent
      },
      {
        path: 'data-setting/application/computer-skills',
        component: ComputerSkillsComponent
      },
      {
        path: 'data-setting/application/language-skills',
        component: LanguageSkillsComponent
      },
      {
        path: 'data-setting/application/university',
        component: UniversityComponent
      },
      {
        path: 'data-setting/application/email/email-template',
        component: EmailTemplateComponent
      },
      {
        path: 'data-setting/application/email/email-template/details',
        component: EmailTemplateDetailsComponent
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
