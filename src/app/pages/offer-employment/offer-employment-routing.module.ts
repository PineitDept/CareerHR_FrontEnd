import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OfferEmploymentComponent } from './offer-employment.component';

const routes: Routes = [
  {
    path: '',
    component: OfferEmploymentComponent,
    children: []
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OfferEmploymentRoutingModule { }
