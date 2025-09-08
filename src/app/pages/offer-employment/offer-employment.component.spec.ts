import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfferEmploymentComponent } from './offer-employment.component';

describe('OfferEmploymentComponent', () => {
  let component: OfferEmploymentComponent;
  let fixture: ComponentFixture<OfferEmploymentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OfferEmploymentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfferEmploymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
