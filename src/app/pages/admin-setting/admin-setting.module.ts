import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSettingComponent } from './admin-setting.component';
import { AdminSettingRoutingModule } from './admin-setting-routing.module';
import { UserCandidatesComponent } from './pages/permissions/user-candidates/user-candidates.component';
import { UserWebComponent } from './pages/permissions/user-web/user-web.component';
import { ManagementUserComponent } from './pages/permissions/management-user/management-user.component';
import { JobPositionComponent } from './pages/data-setting/manpower/job-position/job-position.component';
import { ReasonRequestComponent } from './pages/data-setting/manpower/reason-request/reason-request.component';
import { WebPolicyComponent } from './pages/data-setting/application/web-policy/web-policy.component';
import { GeneralBenefitsComponent } from './pages/data-setting/application/general-benefits/general-benefits.component';
import { EmailTemplateComponent } from './pages/data-setting/application/email/email-template/email-template.component';
import { EmailAttributeComponent } from './pages/data-setting/application/email/email-attribute/email-attribute.component';
import { SharedModule } from '../../shared/shared.module';
import { ApplicationQuestionComponent } from './pages/data-setting/application/application-question/application-question.component';
import { ApplicationQuestionDetailsComponent } from './pages/data-setting/application/application-question/pages/application-question-details/application-question-details.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SpecialBenefitsComponent } from './pages/data-setting/application/special-benefits/special-benefits.component';
import { ComputerSkillsComponent } from './pages/data-setting/application/computer-skills/computer-skills.component';
import { LanguageSkillsComponent } from './pages/data-setting/application/language-skills/language-skills.component';
import { UniversityComponent } from './pages/data-setting/application/university/university.component';
import { QuillModule } from 'ngx-quill';
import { EmailTemplateDetailsComponent } from './pages/data-setting/application/email/email-template/pages/email-template-details/email-template-details.component';

@NgModule({
  declarations: [
    AdminSettingComponent,
    UserCandidatesComponent,
    UserWebComponent,
    ManagementUserComponent,
    JobPositionComponent,
    ReasonRequestComponent,
    WebPolicyComponent,
    GeneralBenefitsComponent,
    EmailTemplateComponent,
    EmailAttributeComponent,
    ApplicationQuestionComponent,
    ApplicationQuestionDetailsComponent,
    SpecialBenefitsComponent,
    ComputerSkillsComponent,
    LanguageSkillsComponent,
    UniversityComponent,
    EmailTemplateDetailsComponent
  ],
  imports: [
    CommonModule,
    AdminSettingRoutingModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    QuillModule.forRoot()
  ]
})
export class AdminSettingModule { }
