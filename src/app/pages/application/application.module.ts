import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { ScreeningComponent } from './screening/screening.component';
import { ApplicationRoutingModule } from './application-routing.module';
import { AllApplicationComponent } from './all-application/all-application.component';
import { TrackingComponent } from './tracking/tracking.component';
import { ApplicationFormComponent } from './application-form/application-form.component';
import { SlickCarouselModule } from 'ngx-slick-carousel';
import { ApplicationFormDetailsComponent } from './application-form-details/application-form-details.component';
import { FormApplyComponent } from './form-apply/form-apply.component';
@NgModule({
  declarations: [
    ScreeningComponent,
    AllApplicationComponent,
    TrackingComponent,
    ApplicationFormComponent,
    ApplicationFormDetailsComponent,
    FormApplyComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ApplicationRoutingModule,
    SlickCarouselModule,
  ],
  exports: [
    ScreeningComponent
  ]
})

export class ApplicationModule { }
