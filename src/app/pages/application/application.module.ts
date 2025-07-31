import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { ScreeningComponent } from './screening/screening.component';
import { ApplicationRoutingModule } from './application-routing.module';
import { AllApplicationComponent } from './all-application/all-application.component';
import { TrackingComponent } from './tracking/tracking.component';
@NgModule({
  declarations: [
    ScreeningComponent,
    AllApplicationComponent,
    TrackingComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ApplicationRoutingModule,
  ],
  exports: [
    ScreeningComponent
  ]
})

export class ApplicationModule { }
