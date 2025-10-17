import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OfferEmploymentRoutingModule } from './offer-employment-routing.module';
import { OfferResultComponent } from './pages/offer-result/offer-result.component';
import { HireResultComponent } from './pages/hire-result/hire-result.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { A11yModule } from '@angular/cdk/a11y';
import { OfferEmploymentHistoryComponent } from './pages/offer-employment-history/offer-employment-history.component';


@NgModule({
  declarations: [
    OfferResultComponent,
    HireResultComponent,
    OfferEmploymentHistoryComponent
  ],
  imports: [
    CommonModule,
    OfferEmploymentRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    A11yModule
  ]
})
export class OfferEmploymentModule { }
