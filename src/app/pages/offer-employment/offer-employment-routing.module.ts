import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OfferEmploymentComponent } from './offer-employment.component';
import { HireResultComponent } from './pages/hire-result/hire-result.component';
import { OfferResultComponent } from './pages/offer-result/offer-result.component';
import { PendingDraftsGuard } from '../../guards/pending-draft.guard';
import { OfferEmploymentHistoryComponent } from './pages/offer-employment-history/offer-employment-history.component';

const routes: Routes = [
  {
    path: '',
    component: OfferEmploymentComponent,
    children: [
      {
        path: 'hire-result',
        component: HireResultComponent,
        canDeactivate: [PendingDraftsGuard]
      },
      {
        path: 'offer-result',
        component: OfferResultComponent,
        canDeactivate: [PendingDraftsGuard]
      },
      {
        path: 'history',
        component: OfferEmploymentHistoryComponent,
      },
    ]
  }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OfferEmploymentRoutingModule { }
