import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { InterviewSchedulingRoutingModule } from './interview-scheduling-routing.module';
import { AppointmentCalendarComponent } from './appointment-calendar/appointment-calendar.component';
import { InterviewRound1Component } from './interview-round-1/interview-round-1.component';
import { InterviewRound2Component } from './interview-round-2/interview-round-2.component';
import { A11yModule } from "@angular/cdk/a11y";
import { InterviewRound1HistoryComponent } from './interview-round-1/pages/interview-round-1-history/interview-round-1-history.component';
import { InterviewRound2HistoryComponent } from './interview-round-2/pages/interview-round-2-history/interview-round-2-history.component';
import { InterviewFormComponent } from './interview-form/interview-form.component';
import { InterviewFormDetailsComponent } from './interview-form/pages/interview-form-details/interview-form-details.component';

@NgModule({
  declarations: [
    AppointmentCalendarComponent,
    InterviewRound1Component,
    InterviewRound2Component,
    InterviewRound1HistoryComponent,
    InterviewRound2HistoryComponent,
    InterviewFormComponent,
    InterviewFormDetailsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    InterviewSchedulingRoutingModule,
    A11yModule
],
  // exports: [
  //   AppointmentCalendarComponent,
  //   InterviewRound1Component,
  //   InterviewRound2Component,
  // ]
})
export class InterviewSchedulingModule { }
