import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ApplicationComponent } from './application.component';
import { ScreeningComponent } from './screening/screening.component';
import { AllApplicationComponent } from './all-application/all-application.component';
import { TrackingComponent } from './tracking/tracking.component';
import { ApplicationFormComponent } from './application-form/application-form.component';

const routes: Routes = [
  {
    path: '',
    component: ApplicationComponent,
    children: [
      {
        path: 'all-applications',
        component: AllApplicationComponent,
      },
      {
        path: 'screening',
       component: ScreeningComponent,
      },
      {
        path: 'screening/application-form',
        component: ApplicationFormComponent
      },
      {
        path: 'tracking',
         component: TrackingComponent,
      },
      {
        path: 'tracking/application-form',
        component: ApplicationFormComponent
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApplicationRoutingModule { }
