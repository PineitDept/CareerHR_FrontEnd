import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ApplicationComponent } from './application.component';
import { ScreeningComponent } from './screening/screening.component';
import { AllApplicationComponent } from './all-application/all-application.component';
import { TrackingComponent } from './tracking/tracking.component';

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
        path: 'tracking',
         component: TrackingComponent,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApplicationRoutingModule { }
