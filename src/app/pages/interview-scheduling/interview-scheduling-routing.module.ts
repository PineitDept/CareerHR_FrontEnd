import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InterviewSchedulingComponent } from './interview-scheduling.component';
import { AppointmentCalendarComponent } from './appointment-calendar/appointment-calendar.component';
import { InterviewRound1Component } from './interview-round-1/interview-round-1.component';
import { InterviewRound2Component } from './interview-round-2/interview-round-2.component';
import { InterviewRound1HistoryComponent } from './interview-round-1/pages/interview-round-1-history/interview-round-1-history.component';
import { InterviewRound2HistoryComponent } from './interview-round-2/pages/interview-round-2-history/interview-round-2-history.component';
import { InterviewFormComponent } from './interview-form/interview-form.component';
import { InterviewFormDetailsComponent } from './interview-form/pages/interview-form-details/interview-form-details.component';
import { InterviewReviewComponent } from './interview-form/pages/interview-review/interview-review.component';
import { InterviewDetailsComponent } from './interview-form/pages/interview-details/interview-details.component';

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
        path: 'interview-round-1/history',
        component: InterviewRound1HistoryComponent
      },
      {
        path: 'interview-round-2',
        component: InterviewRound2Component,
      },
      {
        path: 'interview-round-2/history',
        component: InterviewRound2HistoryComponent
      },
      {
        path: 'interview-form',
        component: InterviewFormComponent,
      },
      {
        path: 'interview-form/result',
        component: InterviewFormDetailsComponent,
      },
      {
        path: 'interview-form/review',
        component: InterviewReviewComponent,
      },
      {
        path: 'interview-form/details',
        component: InterviewDetailsComponent,
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterviewSchedulingRoutingModule { }
