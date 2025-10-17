import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfferEmploymentHistoryComponent } from './offer-employment-history.component';

describe('OfferEmploymentHistoryComponent', () => {
  let component: OfferEmploymentHistoryComponent;
  let fixture: ComponentFixture<OfferEmploymentHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OfferEmploymentHistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfferEmploymentHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
