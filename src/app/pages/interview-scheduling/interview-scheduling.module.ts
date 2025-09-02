import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { InterviewSchedulingRoutingModule } from './interview-scheduling-routing.module';
import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { InterviewRound1Component } from './interview-round-1/interview-round-1.component';
import { InterviewRound2Component } from './interview-round-2/interview-round-2.component';

@NgModule({
  declarations: [
    AppointmentListComponent,
    InterviewRound1Component,
    InterviewRound2Component,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    InterviewSchedulingRoutingModule,
  ],
  // exports: [
  //   AppointmentListComponent,
  //   InterviewRound1Component,
  //   InterviewRound2Component,
  // ]
})
export class InterviewSchedulingModule { }
