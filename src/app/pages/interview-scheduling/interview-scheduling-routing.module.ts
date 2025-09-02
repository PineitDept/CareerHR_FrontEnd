import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InterviewSchedulingComponent } from './interview-scheduling.component';
import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { InterviewRound1Component } from './interview-round-1/interview-round-1.component';
import { InterviewRound2Component } from './interview-round-2/interview-round-2.component';

const routes: Routes = [
  {
    path: '',
    component: InterviewSchedulingComponent,
    children: [
      {
        path: 'appointment-list',
        component: AppointmentListComponent,
      },
      {
        path: 'interview-round-1',
        component: InterviewRound1Component,
      },
      {
        path: 'interview-round-2',
        component: InterviewRound2Component,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterviewSchedulingRoutingModule { }
