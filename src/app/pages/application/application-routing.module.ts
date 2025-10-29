import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ApplicationComponent } from './application.component';
import { ScreeningComponent } from './screening/screening.component';
import { AllApplicationComponent } from './all-application/all-application.component';
import { TrackingComponent } from './tracking/tracking.component';
import { ApplicationFormComponent } from './application-form/application-form.component';
import { ApplicationFormDetailsComponent } from './application-form-details/application-form-details.component';

const routes: Routes = [
  {
    path: '',
    component: ApplicationComponent,
    children: [
      {
        path: 'all-applications',
        component: AllApplicationComponent,
        data: { keepAlive: true }
      },
      {
        path: 'all-applications/application-form',
        component: ApplicationFormComponent,
        data: { keepAlive: true }
      },
      {
        path: 'all-applications/application-form/details',
        component: ApplicationFormDetailsComponent,
        data: { keepAlive: true }
      },
      {
        path: 'screening',
        component: ScreeningComponent,
        data: { keepAlive: true }
      },
      {
        path: 'screening/application-form',
        component: ApplicationFormComponent,
        data: { keepAlive: true }
      },
      {
        path: 'screening/application-form/details',
        component: ApplicationFormDetailsComponent,
        data: { keepAlive: true }
      },
      {
        path: 'tracking',
        component: TrackingComponent,
        data: { keepAlive: true }
      },
      {
        path: 'tracking/application-form',
        component: ApplicationFormComponent,
        data: { keepAlive: true }
      },
      {
        path: 'tracking/application-form/details',
        component: ApplicationFormDetailsComponent,
        data: { keepAlive: true }
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApplicationRoutingModule { }
