import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfferResultComponent } from './offer-result.component';

describe('OfferResultComponent', () => {
  let component: OfferResultComponent;
  let fixture: ComponentFixture<OfferResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OfferResultComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfferResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
