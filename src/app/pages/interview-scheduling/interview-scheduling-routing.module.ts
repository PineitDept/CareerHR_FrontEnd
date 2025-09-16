import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InterviewSchedulingComponent } from './interview-scheduling.component';
import { AppointmentCalendarComponent } from './appointment-calendar/appointment-calendar.component';
import { InterviewRound1Component } from './interview-round-1/interview-round-1.component';
import { InterviewRound2Component } from './interview-round-2/interview-round-2.component';
import { InterviewRound1HistoryComponent } from './interview-round-1/pages/interview-round-1-history/interview-round-1-history.component';

const routes: Routes = [
  {
    path: '',
    component: InterviewSchedulingComponent,
    children: [
      {
        path: 'appointment-calendar',
        component: AppointmentCalendarComponent,
      },
      {
        path: 'interview-round-1',
        component: InterviewRound1Component,
      },
      {
        path: 'interview-round-2',
        component: InterviewRound2Component,
      },
      {
        path: 'interview-round-1/history',
        component: InterviewRound1HistoryComponent
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterviewSchedulingRoutingModule { }
